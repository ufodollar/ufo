// ============================================================================
// 读链层：直接说 JSON-RPC，不经过 ethers
// ----------------------------------------------------------------------------
// 页面上的读操作全是 eth_call，参数只有 address / uint256 两种，
// 编码规则就是把 32 字节往右一贴。为了这点事把 270KB 的 ethers 塞进首屏，
// 是拿用户的流量和低端机的解析时间去换开发者的省事。
//
// 选择器是 keccak("函数签名") 的前 4 字节，构建时算好写死在这里。
// 合约不变，它们就不会变。
// ============================================================================

import { CONFIG, RPC_URL, RPC_FALLBACKS } from './config';

// keccak("签名") 的前 4 字节。只做「读」用到的三个，写链走 ethers 自带的编码。
const SEL = {
  balanceOf: '0x70a08231',
  getExchangeRate: '0xe6aa216c',
  getPrice: '0x41976e09'
};

/** address → 32 字节左补零 */
const padAddress = (addr) => addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');

export const encodeBalanceOf = (owner) => SEL.balanceOf + padAddress(owner);

/** 从 32 字节 ABI 字里取 uint256 */
export const decodeUint = (hex) => (hex && hex !== '0x' ? BigInt(hex) : null);

let rpcId = 0;

// ---------------------------------------------------------------------------
// 一次 POST，失败就换下一个节点
// ---------------------------------------------------------------------------
// 只处理「网络层」失败：连不上、超时、非 2xx。JSON-RPC 的业务错误
// （json.error，比如 revert）会原样返回给调用方，不该换节点重试 ——
// 换十次也是同一个 revert，只会把一次失败拖成三十秒。
const ENDPOINTS = [RPC_URL, ...RPC_FALLBACKS];
let preferred = 0;

async function postJson(payload, timeoutMs) {
  let lastError = null;
  for (let i = 0; i < ENDPOINTS.length; i++) {
    const idx = (preferred + i) % ENDPOINTS.length;
    const ctl = new AbortController();
    const timer = setTimeout(() => { try { ctl.abort(); } catch (e) { /* noop */ } }, timeoutMs);
    try {
      const res = await fetch(ENDPOINTS[idx], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl.signal
      });
      if (!res.ok) throw new Error('RPC HTTP ' + res.status);
      const json = await res.json();
      // 能用的这个记下来，后续请求先试它，避免每次都从坏节点开始
      preferred = idx;
      return json;
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  const err = lastError || new Error('RPC unreachable');
  if (err && err.name === 'AbortError') throw new Error('RPC timeout');
  throw err;
}

/**
 * 通用 JSON-RPC。除了 eth_call 之外，交易层还要预取 nonce / gasPrice /
 * estimateGas / receipt —— 这些都不能问钱包。
 *
 * OKX Connect 只代理签名类方法，eth_getTransactionCount、eth_estimateGas、
 * eth_getTransactionReceipt 一律不支持。所以「读」永远走这条公共 RPC，
 * 钱包只负责最后那一次 eth_sendTransaction 的签名。
 *
 * ★ 必须带超时。fetch 本身没有默认超时：RPC 丢包或回源卡住时，这个 await
 *   会一直挂着，页面就停在「加载中」，余额、价格、按钮全部空着，用户以为
 *   网站坏了。移动网络切换（4G ↔ Wi-Fi）时尤其容易触发。
 */
export async function rpcCall(method, params, timeoutMs = 12000) {
  const json = await postJson({ jsonrpc: '2.0', id: ++rpcId, method, params }, timeoutMs);
  if (json && json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

/** 单次 eth_call */
export async function ethCall(to, data) {
  return rpcCall('eth_call', [{ to, data }, 'latest']);
}

/**
 * 一次 HTTP 往返取回多个值。
 * 六个独立请求在移动网络上的差别不是带宽，是 6 个 RTT —— 400ms 起。
 * 每项可以是 { to, data }（eth_call），也可以是 { method, params }（自定义）。
 */
export async function ethBatch(calls, timeoutMs = 12000) {
  const payload = calls.map((c, i) => ({
    jsonrpc: '2.0',
    id: i + 1,
    method: c.method || 'eth_call',
    params: c.params || [{ to: c.to, data: c.data }, 'latest']
  }));

  // 同 rpcCall：没有超时就是「偶尔永远转圈」
  const json = await postJson(payload, timeoutMs);
  if (!Array.isArray(json)) throw new Error('RPC batch rejected');

  const byId = {};
  for (const item of json) byId[item.id] = item;
  return calls.map((_, i) => {
    const item = byId[i + 1];
    return item && item.result ? item.result : null;
  });
}

/** UFO 的链上净值（1 UFO = ? USD，18 位定标） */
export async function readNav() {
  const raw = await ethCall(CONFIG.VAULT_ADDRESS, SEL.getExchangeRate);
  const v = decodeUint(raw);
  if (v === null) throw new Error('empty nav');
  return Number(v) / 1e18;
}

/** 金库对某稳定币的报价（18 位定标） */
export async function readPrice(tokenAddress) {
  const raw = await ethCall(CONFIG.VAULT_ADDRESS, SEL.getPrice + padAddress(tokenAddress));
  const v = decodeUint(raw);
  if (v === null) throw new Error('empty price');
  return v;
}

/** BNB/USD 预言机答案（8 位定标） */
export async function readBnbPrice() {
  const raw = await ethCall(CONFIG.BNB_ORACLE, '0xfeaf968c');
  if (!raw || raw.length < 2 + 128) throw new Error('bad oracle response');
  const answer = BigInt('0x' + raw.slice(2 + 64, 2 + 128));
  if (answer <= 0n) throw new Error('bad oracle answer');
  return Number(answer) / 1e8;
}

/** 金库里两个稳定币的存量 */
export async function readVaultBalances() {
  const [usdt, usdc] = await ethBatch([
    { to: CONFIG.USDT_ADDRESS, data: encodeBalanceOf(CONFIG.VAULT_ADDRESS) },
    { to: CONFIG.USDC_ADDRESS, data: encodeBalanceOf(CONFIG.VAULT_ADDRESS) }
  ]);
  const units = (hex) => {
    const v = decodeUint(hex);
    return v === null ? 0 : Number(v) / 1e18;
  };
  return { USDT: units(usdt), USDC: units(usdc) };
}

// ============================================================================
// 多代币组合
// ----------------------------------------------------------------------------
// 钱包页与代币弹窗都要「每个代币的余额」。逐个 eth_call 是 N 次往返，
// 手机上 15 个币就是 2~4 秒的空白列表。这里用 JSON-RPC batch 把同一批
// 请求塞进一次 HTTP，按 12 个一组切开 —— 公共节点对单次批量有上限，
// 超了整批返回错误，一个余额都读不到。
// ============================================================================

const SEL_DECIMALS = '0x313ce567';        // decimals()
const SEL_GET_AMOUNTS_OUT = '0xd06ca61f'; // getAmountsOut(uint256,address[])

// PancakeSwap V2 Router02 与 WBNB。不涉及 UFO 的币对从这里直接成交，
// 报价也从同一个合约读 —— 报价和成交用同一个来源，界面上显示的数才不会
// 和用户实际拿到的数差一个池子。
export const PANCAKE_ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
export const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const padWord = (n) => BigInt(n).toString(16).padStart(64, '0');

/** 原生 BNB 在 AMM 里是 WBNB；其余代币就是自己的合约地址 */
export const routeAddress = (t) => {
  if (!t) return null;
  if (t.symbol === 'BNB' || t.native) return WBNB_ADDRESS;
  return t.address || null;
};

/**
 * 候选路径。先试直接交易对，再试经 WBNB / USDT 中转。
 * 没有工厂合约的 getPair 预检：getAmountsOut 在不存在的池子上会直接 revert，
 * 批量里表现为该项返回 null，代价相同但少一轮往返。
 */
export function candidatePaths(from, to) {
  const a = routeAddress(from);
  const b = routeAddress(to);
  if (!a || !b || a.toLowerCase() === b.toLowerCase()) return [];
  const paths = [[a, b]];
  for (const mid of [WBNB_ADDRESS, CONFIG.USDT_ADDRESS]) {
    if (mid.toLowerCase() !== a.toLowerCase() && mid.toLowerCase() !== b.toLowerCase()) {
      paths.push([a, mid, b]);
    }
  }
  return paths;
}

/** getAmountsOut(uint256,address[]) 的 calldata（动态数组，两段偏移） */
export function encodeGetAmountsOut(amountIn, path) {
  let data = SEL_GET_AMOUNTS_OUT + padWord(amountIn) + padWord(64) + padWord(path.length);
  for (const addr of path) data += padAddress(addr);
  return data;
}

/** 解析 uint256[]：offset + length + 逐项 */
function decodeAmounts(hex) {
  if (!hex || hex === '0x') return null;
  const body = hex.slice(2);
  if (body.length < 128) return null;
  const len = Number(BigInt('0x' + body.slice(64, 128)));
  if (!len || len > 8) return null;
  const out = [];
  for (let i = 0; i < len; i++) {
    const word = body.slice(128 + i * 64, 192 + i * 64);
    if (word.length < 64) return null;
    out.push(BigInt('0x' + word));
  }
  return out;
}

/**
 * 一笔 PancakeSwap 报价：候选路径一次批量问完，取第一条有结果的。
 * @returns {Promise<null|{path:string[], amounts:bigint[], amountOutWei:bigint}>}
 */
export async function quotePancake(from, to, amountInWei, timeoutMs = 12000) {
  const paths = candidatePaths(from, to);
  if (!paths.length || BigInt(amountInWei) <= 0n) return null;

  const res = await ethBatch(
    paths.map((p) => ({ to: PANCAKE_ROUTER, data: encodeGetAmountsOut(amountInWei, p) })),
    timeoutMs
  );

  // 所有候选路径都在同一个 batch 里问完，取「到账最多」的那条，而不是第一条
  // 有返回的。BSC 上有不少没人维护的直连池子：DOT/BTCB 直连只报 2.29e-8，
  // 走 DOT→WBNB→BTCB 是 1.12e-5，差 500 倍。先到先得会把用户按垃圾池子的
  // 价格成交 —— 这种事在链上不可逆，必须在报价这一层滤掉。
  let best = null;
  for (let i = 0; i < paths.length; i++) {
    const amounts = decodeAmounts(res[i]);
    if (!amounts || amounts.length !== paths[i].length) continue;
    const out = amounts[amounts.length - 1];
    if (out <= 0n) continue;
    if (!best || out > best.amountOutWei) {
      best = { path: paths[i], amounts, amountOutWei: out };
    }
  }
  return best;
}

async function inChunks(calls, size = 12) {
  const out = [];
  for (let i = 0; i < calls.length; i += size) {
    const part = await ethBatch(calls.slice(i, i + size));
    out.push(...part);
  }
  return out;
}

// ---- decimals：读完一次就记住，链上精度不会变 ----
const DEC_KEY = 'ufo.token.decimals';
let decMemo = null;

function loadDecimals() {
  if (decMemo) return decMemo;
  decMemo = {};
  try {
    const raw = localStorage.getItem(DEC_KEY);
    if (raw) decMemo = JSON.parse(raw) || {};
  } catch (e) { decMemo = {}; }
  return decMemo;
}

function saveDecimals() {
  try { localStorage.setItem(DEC_KEY, JSON.stringify(decMemo)); } catch (e) { /* 无痕模式 */ }
}

/**
 * 取代币精度。缺的才发请求，一次批量补齐。
 * 读不到就退回代币表里的声明值 —— 宁可显示成 0.00 也不要整页空着。
 */
export async function readDecimals(tokens) {
  const memo = loadDecimals();
  const missing = tokens.filter((t) => !t.native && t.address && memo[t.address.toLowerCase()] == null);
  if (missing.length) {
    try {
      const res = await inChunks(missing.map((t) => ({ to: t.address, data: SEL_DECIMALS })));
      missing.forEach((t, i) => {
        const v = decodeUint(res[i]);
        // 有些代币的 decimals 是 0，也会返回 0x…00；只有 null 才算没读到
        if (v !== null && v <= 36n) memo[t.address.toLowerCase()] = Number(v);
      });
      saveDecimals();
    } catch (e) { /* 用声明值兜底 */ }
  }
  return (t) => {
    if (t.native) return 18;
    const v = memo[(t.address || '').toLowerCase()];
    return v == null ? t.decimals : v;
  };
}

/** 余额 = { SYMBOL: number }，一次批量读回 */
export async function readTokenBalances(owner, tokens) {
  if (!owner) return {};
  const decOf = await readDecimals(tokens);
  const erc20 = tokens.filter((t) => !t.native && t.address);

  const calls = [
    { method: 'eth_getBalance', params: [owner, 'latest'] },
    ...erc20.map((t) => ({ to: t.address, data: encodeBalanceOf(owner) }))
  ];
  const res = await inChunks(calls);

  const out = {};
  const bnb = decodeUint(res[0]);
  out.BNB = bnb === null ? 0 : Number(bnb) / 1e18;
  erc20.forEach((t, i) => {
    const raw = decodeUint(res[i + 1]);
    out[t.symbol] = raw === null ? 0 : Number(raw) / 10 ** decOf(t);
  });
  return out;
}

// ---- 价格：链上单价，统一用 PancakeSwap 的 USDT 报价 ----
// 只给「真的持有」的代币取价。余额为 0 的币估值必然是 0，没必要问链。
//
// 为什么要走 Router 的 getAmountsOut 而不是自己算储备：钱包页显示的是
// 「1 个币值多少美元」，用户拿这个数去决定卖不卖；而成交也在同一个 Router
// 上。两边用同一个来源，显示的价格才不会和实际成交价差一截。直接对 <币/ USDT>
// 取价，没有直接交易对就走 WBNB 中转（BSC 上几乎所有币都有 WBNB 池）。
let priceMemo = { at: 0, key: '', map: {} };

const PRICE_TTL_MS = 60000;
const USDT_ADDRESS = CONFIG.USDT_ADDRESS.toLowerCase();

/**
 * @returns {Promise<Object>} { SYMBOL: usdPrice }，取不到的币不会出现在结果里
 */
export async function readTokenPrices(tokens, ttlMs = PRICE_TTL_MS) {
  // UFO 用金库净值（getExchangeRate），不在这里询价：链上没有它的池子，
  // 硬询只会拿到 null，然后钱包页把它显示成「—」。
  const targets = tokens.filter((t) => {
    if (t.symbol === 'UFO' || t.symbol === 'USDT') return false;
    const addr = routeAddress(t);
    return addr && addr.toLowerCase() !== USDT_ADDRESS;
  });

  const key = targets.map((t) => t.symbol).join(',');
  if (priceMemo.key === key && Date.now() - priceMemo.at < ttlMs) return priceMemo.map;
  if (!targets.length) {
    priceMemo = { at: Date.now(), key, map: {} };
    return {};
  }

  const decOf = await readDecimals(tokens);
  const oneUnit = (t) => 10n ** BigInt(decOf(t));

  // USDT 是 18 位，amounts 的最后一项就是美元数 × 1e18
  const priceOf = (hex) => {
    const amounts = decodeAmounts(hex);
    if (!amounts || amounts.length < 2) return null;
    const price = Number(amounts[amounts.length - 1]) / 1e18;
    if (!isFinite(price) || price <= 0 || price > 1e9) return null;
    return price;
  };

  const quote = (list, units, mid) => inChunks(list.map((t) => ({
    to: PANCAKE_ROUTER,
    data: encodeGetAmountsOut(oneUnit(t) * units, mid
      ? [routeAddress(t), WBNB_ADDRESS, CONFIG.USDT_ADDRESS]
      : [routeAddress(t), CONFIG.USDT_ADDRESS])
  })));

  // 两条路都问一遍：直连 <币/USDT>，以及经 WBNB 中转。
  // 不能「先直连、失败才走中转」—— 大量新币的直连池是机器人造的浅池，
  // 报价能成功但价格偏离几十倍（NVDAB 直连 $0.02、真实 $154）。是否可靠
  // 只能靠深度判断，所以两条都问，再比谁更扛得住大额。
  let direct = [];
  let hop = [];
  try {
    [direct, hop] = await Promise.all([quote(targets, 1n, false), quote(targets, 1n, true)]);
  } catch (e) {
    return priceMemo.map;
  }

  const pick = {};
  targets.forEach((t, i) => {
    const d = priceOf(direct[i]);
    const h = priceOf(hop[i]);
    if (d != null && h != null) pick[t.symbol] = { t, i, d, h, both: true };
    else if (d != null) pick[t.symbol] = { t, i, d, h: null, both: false };
    else if (h != null) pick[t.symbol] = { t, i, d: null, h, both: false };
  });

  // 两条都有价：用 1000 个币再问一次，比较价格冲击。
  // 冲击小（大额报价仍然接近 1 个币的单价）的那条路才是真的有深度。
  const dual = Object.values(pick).filter((x) => x.both);
  const better = {};
  if (dual.length) {
    try {
      const [dBig, hBig] = await Promise.all([
        quote(dual.map((x) => x.t), 1000n, false),
        quote(dual.map((x) => x.t), 1000n, true)
      ]);
      dual.forEach((x, k) => {
        const dOut = Number((decodeAmounts(dBig[k]) || []).slice(-1)[0] || 0) / 1e18;
        const hOut = Number((decodeAmounts(hBig[k]) || []).slice(-1)[0] || 0) / 1e18;
        const dRatio = x.d > 0 ? dOut / (1000 * x.d) : 0;
        const hRatio = x.h > 0 ? hOut / (1000 * x.h) : 0;
        better[x.t.symbol] = dRatio >= hRatio ? 'direct' : 'hop';
      });
    } catch (e) { /* 比不出来就按直连 */ }
  }

  const map = {};
  Object.values(pick).forEach((x) => {
    map[x.t.symbol] = better[x.t.symbol] === 'hop' ? x.h : (x.d != null ? x.d : x.h);
  });

  priceMemo = { at: Date.now(), key, map };
  return map;
}
