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
// 路由：USDT/UFO、USDC/UFO 走金库（按 NAV 结算），其余任意币对走 BNB Chain
// 上的 PancakeSwap V2。因此「能不能兑换」不再由这张表决定，而是由链上有没有
// 流动性决定 —— 没有路由时弹窗照常可选，报错发生在报价那一步，说清楚是哪一对。
// ============================================================================

export const CHAIN_NAME = 'BNB Chain';

export const TOKENS = [
  // 顺序就是钱包页与选择弹窗的默认顺序：主流币在前，其余按市场关注度。
  // 每一项的地址都在 BSC 主网用 symbol()/name()/decimals() 回读过，
  // 名字对不上的一律不进来（见文件头的规则）。
  {
    symbol: 'BNB', name: 'BNB Chain', native: true, decimals: 18,
    verified: true, color: '#F0B90B'
  },
  {
    symbol: 'USDT', name: 'Tether', address: CONFIG.USDT_ADDRESS, decimals: 18,
    verified: true, color: '#26A69A'
  },
  {
    symbol: 'USDC', name: 'USD Coin', address: CONFIG.USDC_ADDRESS, decimals: 18,
    verified: true, color: '#2775CA'
  },
  {
    symbol: 'UFO', name: 'UFO Dollar', address: CONFIG.UFO_ADDRESS, decimals: 18,
    verified: true, color: '#3B82F6'
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
    symbol: 'BTCB', name: 'Binance Bitcoin', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18,
    verified: true, color: '#F7931A'
  },
  {
    // 链上 symbol 本身就是小写 quq，照抄，不做美化
    symbol: 'quq', name: 'quq', address: '0x4fa7C69a7B69f8Bc48233024D546bc299d6B03bf', decimals: 18,
    verified: true, color: '#22C55E'
  },
  {
    symbol: 'NVDAB', name: 'NVIDIA Corp', address: '0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436', decimals: 18,
    verified: true, color: '#76B900'
  },
  {
    symbol: 'ETH', name: 'Binance-Peg Ethereum', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18,
    verified: true, color: '#627EEA'
  },
  {
    symbol: 'PIEVERSE', name: 'Pieverse Token', address: '0x0E63B9C287E32A05E6b9AB8ee8dF88A2760225A9', decimals: 18,
    verified: true, color: '#111827'
  },
  {
    symbol: 'U', name: 'United Stables', address: '0xcE24439F2D9C6a2289F741120FE202248B666666', decimals: 18,
    verified: true, color: '#3B82F6'
  },
  {
    symbol: 'DGAI', name: 'DGrid AI', address: '0x10D4183389e99233db3cc981c43443Ebd28Ebd5e', decimals: 18,
    verified: true, color: '#84CC16'
  },
  {
    symbol: 'ARIA', name: 'ARIA.AI', address: '0x5d3A12C42E5372B2CC3264AB3cdcF660a1555238', decimals: 18,
    verified: true, color: '#7DD3FC'
  },
  {
    symbol: 'USD1', name: 'World Liberty Financial USD', address: '0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d', decimals: 18,
    verified: true, color: '#C9A227'
  },
  {
    symbol: 'DNA', name: 'DE NEO AGENT', address: '0xA991F61940095AEA0724ef54077223B048c5CF7b', decimals: 18,
    verified: true, color: '#22D3EE'
  },
  {
    symbol: 'ANTB', name: 'Anthropic', address: '0x38Dd26788Cf2d901E3aBf04efE3007d459d0Fc53', decimals: 18,
    verified: true, color: '#D97706'
  },
  {
    symbol: 'ON', name: 'Orochi Network Token', address: '0x0e4F6209eD984b21EDEA43acE6e09559eD051D48', decimals: 18,
    verified: true, color: '#F97316'
  },
  {
    symbol: 'BNCB', name: 'CEA Industries', address: '0x4902C5ebc598265Ed2212b559B042De8a5Eeec3f', decimals: 18,
    verified: true, color: '#16A34A'
  },
  {
    symbol: 'CYS', name: 'Cysic Token', address: '0x0C69199C1562233640e0Db5Ce2c399A88eB507C7', decimals: 18,
    verified: true, color: '#0EA5E9'
  },
  {
    symbol: 'EVAA', name: 'EVAA', address: '0xaa036928c9c0Df07d525B55ea8EE690Bb5a628C1', decimals: 18,
    verified: true, color: '#7C3AED'
  },
  {
    symbol: 'RYDE4', name: 'Ryde Group', address: '0x6a2b0B704650A93F7495d728C3b851A1c5f73172', decimals: 18,
    verified: true, color: '#EC4899'
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

export const UFO_TOKEN = TOKEN_BY_SYMBOL.UFO;
export const BNB_TOKEN = TOKEN_BY_SYMBOL.BNB;
export const STABLECOINS = [TOKEN_BY_SYMBOL.USDT, TOKEN_BY_SYMBOL.USDC];

/** 金库只为这两种币对报价，其余币对一律走 BNB Chain 上的 AMM */
export const isVaultPair = (a, b) => {
  if (!a || !b) return false;
  const s1 = a.symbol, s2 = b.symbol;
  if (s1 === s2) return false;
  if (s1 !== 'UFO' && s2 !== 'UFO') return false;
  const other = s1 === 'UFO' ? s2 : s1;
  return other === 'USDT' || other === 'USDC';
};

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

/**
 * 报价用的数量格式：既不掉有效数字，也不写科学计数法。
 *
 * 1 DOT 换 BTCB 只有 0.00001118 个，按 6 位小数一截就成了 "0.000000"，
 * 界面把它读成 0 —— 于是明明有报价，Rate 和到账量却双双显示「—」。
 * 这里对极小值按「首位有效数字」补位（最多 12 位小数），
 * 0.0000000000000229 也照样读得出来，而 123.456 仍然是 123.456。
 */
export function formatTokenAmount(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 0.0001) {
    const s = n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    return s === '' ? '0' : s;
  }
  const dp = Math.min(12, 4 - Math.floor(Math.log10(n)));
  return n.toFixed(dp).replace(/0+$/, '').replace(/\.$/, '');
}

// ============================================================================
// 代币图标
// ----------------------------------------------------------------------------
// ERC-20 标准里没有图标字段 —— 链上只有 name / symbol / decimals，
// 图标一律是钱包按「合约地址」去外部资产库查出来的，没有任何「从链上拉」的
// 办法。主流钱包用的就是 Trust Wallet 的 assets 仓库（按链 + 地址组织）：
//   .../blockchains/smartchain/assets/<checksum-address>/logo.png
// 路径里的地址必须是 EIP-55 校验和格式，小写会 404，所以下面这些地址都是
// 现成校验和过的，不要手动改大小写。
//
// 三个源按可达性排：jsDelivr（国内有节点）→ Trust Wallet 自己的 CDN →
// GitHub raw。前一个失败才退下一个，全失败就用内置矢量图，图标位永远不会空。
// ============================================================================
const LOGO_HOSTS = [
  (p) => `https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/smartchain/${p}`,
  (p) => `https://assets-cdn.trustwallet.com/blockchains/smartchain/${p}`,
  (p) => `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/${p}`
];

export function logoSources(token) {
  if (!token) return [];
  if (token.logoURI) return [token.logoURI];
  const path = token.native
    ? 'info/logo.png'
    : token.address
      ? `assets/${token.address}/logo.png`
      : '';
  if (!path) return [];
  return LOGO_HOSTS.map((host) => host(path));
}
