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

import { CONFIG, RPC_URL } from './config';

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

/** 单次 eth_call */
export async function ethCall(to, data) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'eth_call', params: [{ to, data }, 'latest'] })
  });
  const json = await res.json();
  if (json && json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

/**
 * 一次 HTTP 往返取回多个值。
 * 六个独立请求在移动网络上的差别不是带宽，是 6 个 RTT —— 400ms 起。
 * 每项可以是 { to, data }（eth_call），也可以是 { method, params }（自定义）。
 */
export async function ethBatch(calls) {
  const payload = calls.map((c, i) => ({
    jsonrpc: '2.0',
    id: i + 1,
    method: c.method || 'eth_call',
    params: c.params || [{ to: c.to, data: c.data }, 'latest']
  }));

  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
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
