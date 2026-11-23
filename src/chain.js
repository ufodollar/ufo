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

/**
 * 钱包快照：BNB + USDT + USDC + UFO + BNB 价格，一次往返。
 * 原来要走 6 次（其中 BNB 还绕道钱包自己的 RPC，最慢）。
 */
export async function readWalletSnapshot(owner) {
  const [bnbHex, usdtHex, usdcHex, ufoHex, oracleHex] = await ethBatch([
    { method: 'eth_getBalance', params: [owner, 'latest'] },
    { to: CONFIG.USDT_ADDRESS, data: encodeBalanceOf(owner) },
    { to: CONFIG.USDC_ADDRESS, data: encodeBalanceOf(owner) },
    { to: CONFIG.UFO_ADDRESS, data: encodeBalanceOf(owner) },
    { to: CONFIG.BNB_ORACLE, data: '0xfeaf968c' }
  ]);

  const units = (hex) => {
    const v = decodeUint(hex);
    return v === null ? null : Number(v) / 1e18;
  };

  let bnbPrice = null;
  if (oracleHex && oracleHex.length >= 2 + 128) {
    const answer = BigInt('0x' + oracleHex.slice(2 + 64, 2 + 128));
    if (answer > 0n) bnbPrice = Number(answer) / 1e8;
  }

  return {
    bnb: units(bnbHex),
    USDT: units(usdtHex),
    USDC: units(usdcHex),
    UFO: units(ufoHex),
    bnbPrice
  };
}

// ============================================================================
// 多代币组合
// ----------------------------------------------------------------------------
// 钱包页与代币弹窗都要「每个代币的余额」。逐个 eth_call 是 N 次往返，
// 手机上 15 个币就是 2~4 秒的空白列表。这里用 JSON-RPC batch 把同一批
// 请求塞进一次 HTTP，按 12 个一组切开 —— 公共节点对单次批量有上限，
// 超了整批返回错误，一个余额都读不到。
// ============================================================================

const SEL_DECIMALS = '0x313ce567';       // decimals()
const SEL_GET_RESERVES = '0x0902f1ac';   // getReserves()
const SEL_GET_PAIR = '0xe6a43905';       // getPair(address,address)

// PancakeSwap V2。选它做报价源不是为了交易，而是因为它有 BSC 上最全的
// 代币/稳定币交易对：一个只读的、无需许可的价格来源，不依赖任何 API key。
const PANCAKE_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const padWord = (n) => BigInt(n).toString(16).padStart(64, '0');

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

// ---- 价格：PancakeSwap V2 的 USDT 交易对储备 ----
// 只给「真的持有」的代币取价。余额为 0 的币估值必然是 0，没必要问链。
let priceMemo = { at: 0, key: '', map: {} };

/**
 * @returns {Promise<Object>} { SYMBOL: usdPrice }，取不到的币不会出现在结果里
 */
export async function readTokenPrices(tokens, ttlMs = 60000) {
  const key = tokens.map((t) => t.symbol).join(',');
  if (priceMemo.key === key && Date.now() - priceMemo.at < ttlMs) return priceMemo.map;

  const decOf = await readDecimals(tokens);
  const usdt = tokens.find((t) => t.symbol === 'USDT');
  if (!usdt) return {};

  // 统一把 BNB 折成 WBNB 一起询价（原生币没有自己的交易对）
  const quoted = tokens
    .filter((t) => t.symbol !== 'USDT' && t.symbol !== 'UFO')
    .map((t) => ({ ...t, pairToken: t.symbol === 'BNB' ? { ...t, address: WBNB_ADDRESS, native: false, decimals: 18, symbol: 'WBNB' } : t }));

  if (!quoted.length) return {};

  const pairCalls = quoted.map((t) => ({
    to: PANCAKE_FACTORY,
    data: SEL_GET_PAIR + padAddress(t.pairToken.address) + padAddress(usdt.address)
  }));

  let pairs;
  try {
    pairs = await inChunks(pairCalls);
  } catch (e) {
    return priceMemo.map;
  }

  const live = quoted
    .map((t, i) => ({ t, pair: pairs[i] && pairs[i] !== '0x' ? '0x' + pairs[i].slice(-40) : null }))
    .filter((x) => x.pair && x.pair !== '0x0000000000000000000000000000000000000000');

  if (!live.length) return {};

  let reserves;
  try {
    reserves = await inChunks(live.map((x) => ({ to: x.pair, data: SEL_GET_RESERVES })));
  } catch (e) {
    return priceMemo.map;
  }

  const map = {};
  live.forEach((x, i) => {
    const hex = reserves[i];
    if (!hex || hex.length < 2 + 192) return;
    const r0 = BigInt('0x' + hex.slice(2, 66));
    const r1 = BigInt('0x' + hex.slice(66, 130));
    if (r0 === 0n || r1 === 0n) return;

    // token0 是地址较小的那个，和传参顺序无关
    const tokenIsToken0 = x.t.pairToken.address.toLowerCase() < usdt.address.toLowerCase();
    const tokenReserve = tokenIsToken0 ? r0 : r1;
    const usdtReserve = tokenIsToken0 ? r1 : r0;

    const tokenAmount = Number(tokenReserve) / 10 ** decOf(x.t.pairToken);
    const usdtAmount = Number(usdtReserve) / 1e18;
    if (!(tokenAmount > 0) || !(usdtAmount > 0)) return;

    const price = usdtAmount / tokenAmount;
    if (!isFinite(price) || price <= 0) return;
    map[x.t.symbol] = price;
  });

  priceMemo = { at: Date.now(), key, map };
  return map;
}
