// 链上常量。之前散在 App.jsx 顶部，现在单独放，读链层和 UI 层都要用。

export const CONFIG = {
  VAULT_ADDRESS: '0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2',
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',

  FEE_RATE: 0.005,
  PRICE_DECIMALS: 18,
  MAX_PRICE_DEVIATION: 0.02
};

export const RPC_URL = 'https://rpc.ankr.com/bsc/6697e20a67ff784e1da4e725453d8a62d2b48a7318a00cba946637e2b0e1e749';

/**
 * 备用 RPC。
 *
 * 主节点是 Ankr 的公共 key —— 这类 key 被限流是常态（同一 key 被别的站点
 * 抓去用、或者只是这个 IP 段超配额）。一旦它返回 429，余额、价格、nonce、
 * gas、回执全部读不到，页面表现是「余额 0 + 按钮点不动 + 交易永远 pending」，
 * 而这些都不是网络断了。
 *
 * 这两条是 BSC 官方 dataseed，不带 key、不依赖任何厂商账号。
 * 第三条是 PublicNode，独立于币安基础设施 —— 前两条同时抽风时还有得选。
 * chain.js 只在网络层失败时才切换；JSON-RPC 返回的业务错误不会触发切换。
 */
export const RPC_FALLBACKS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.defibit.io/',
  'https://bsc.publicnode.com'
];
