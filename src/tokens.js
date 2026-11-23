import { CONFIG } from './config';

// ============================================================================
// 代币表
// ----------------------------------------------------------------------------
// 这就是「钱包里的资产清单」：代币弹窗、钱包资产列表、发送面板都读这一份，
// 三处不可能再出现「弹窗里有 BTCB、资产列表里没有」这种对不上的情况。
//
// 地址全部是 BNB Smart Chain 上的 BEP-20 合约，与主网一致；UFO 是本产品的
// 贸易币。**不要凭记忆往里加地址** —— 一个错地址等于让用户把币打进黑洞，
// 所以这里只放已经在链上核对过、且被主流 token list 收录的币种。
//
// decimals 只作为读到链上 decimals() 之前的占位；真实精度在运行时读合约，
// 因为同一个代币在不同链上精度可能不同，写死会差 10^12 倍。
//
// tradable = 金库合约能为它报价，也就是能真正走闪兑。其余币种只用于展示与
// 转账 —— 选它做兑换会让交易在链上 revert，那比直接说清楚更糟。
// ============================================================================

export const CHAIN_NAME = 'BNB Chain';

export const TOKENS = [
  {
    symbol: 'BNB', name: 'BNB Chain', native: true, decimals: 18,
    verified: true, tradable: false, color: '#F0B90B'
  },
  {
    symbol: 'USDT', name: 'Tether', address: CONFIG.USDT_ADDRESS, decimals: 18,
    verified: true, tradable: true, color: '#26A69A'
  },
  {
    symbol: 'USDC', name: 'USD Coin', address: CONFIG.USDC_ADDRESS, decimals: 18,
    verified: true, tradable: true, color: '#2775CA'
  },
  {
    symbol: 'UFO', name: 'UFO Dollar', address: CONFIG.UFO_ADDRESS, decimals: 18,
    verified: true, tradable: true, color: '#3B82F6'
  },
  {
    symbol: 'BTCB', name: 'Binance Bitcoin', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18,
    verified: true, color: '#F7931A'
  },
  {
    symbol: 'ETH', name: 'Binance-Peg Ethereum', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18,
    verified: true, color: '#627EEA'
  },
  {
    symbol: 'WBNB', name: 'Wrapped BNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18,
    verified: true, color: '#F0B90B'
  },
  {
    symbol: 'CAKE', name: 'PancakeSwap', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18,
    verified: true, color: '#1FC7D4'
  },
  {
    symbol: 'BUSD', name: 'Binance USD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18,
    verified: true, color: '#F0B90B'
  },
  {
    symbol: 'FDUSD', name: 'First Digital USD', address: '0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409', decimals: 18,
    verified: true, color: '#0F9D8F'
  },
  {
    symbol: 'LINK', name: 'Chainlink', address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', decimals: 18,
    verified: true, color: '#2A5ADA'
  },
  {
    symbol: 'DOT', name: 'Polkadot', address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals: 18,
    verified: true, color: '#E6007A'
  },
  {
    symbol: 'XRP', name: 'XRP', address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18,
    verified: true, color: '#23292F'
  },
  {
    symbol: 'DOGE', name: 'Binance-Peg Dogecoin', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8,
    verified: true, color: '#C2A633'
  },
  {
    symbol: 'DAI', name: 'Dai Stablecoin', address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18,
    verified: true, color: '#F5AC37'
  }
];

export const TOKEN_BY_SYMBOL = TOKENS.reduce((m, t) => { m[t.symbol] = t; return m; }, {});

/** 金库能为这些币报价，因而是真正可兑换的 */
export const SWAP_TOKENS = TOKENS.filter((t) => t.tradable);

export const UFO_TOKEN = TOKEN_BY_SYMBOL.UFO;
export const BNB_TOKEN = TOKEN_BY_SYMBOL.BNB;
export const STABLECOINS = [TOKEN_BY_SYMBOL.USDT, TOKEN_BY_SYMBOL.USDC];

/** 稳定币在无行情时按 1 美元显示 —— 这是唯一允许的「假定价格」 */
export const isStable = (symbol) => symbol === 'USDT' || symbol === 'USDC' || symbol === 'BUSD' ||
  symbol === 'FDUSD' || symbol === 'DAI' || symbol === 'TUSD';

/** 去掉尾随 0，避免资产列表里出现 0.000000000 这种噪声 */
export function formatAmount(v, maxDp = 6) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  if (n === 0) return '0';
  if (n > 0 && n < 0.000001) return '<0.000001';
  return n.toLocaleString('en-US', { maximumFractionDigits: maxDp });
}
