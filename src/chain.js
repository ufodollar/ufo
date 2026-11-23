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
