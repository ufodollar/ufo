import React from 'react';

// ============================================================================
// 代币图标
// ----------------------------------------------------------------------------
// 市面上的钱包（Trust Wallet、MetaMask、Rabby）取图标的方式是同一条链路：
// 维护一份 token list，每条带 address + decimals + logoURI，图标来自
// Trust Wallet 的 assets 仓库或 CoinGecko 的 CDN，运行时按 logoURI 拉。
//
// 这里不能那么做，原因有二：
//   1. 本产品的用户大量在国内网络，assets.coingecko.com / raw.githubusercontent
//      实测经常十几秒超时，图标位就成了永久空白；
//   2. 图标是第三方内容，多一个外链就多一个能被替换、被劫持、被墙的输入。
//
// 所以图标和代币地址一样，作为静态资源随包发布：BNB / USDT / USDC 用官方
// 矢量路径原样内联，其余按各项目官方标志的配色与几何重绘（40×40 圆底）。
// 想换成远程图只需给 tokens.js 里的条目加 logoURI —— TokenIcon 会优先用它。
// ============================================================================

/** 40×40 圆底 + 内容 */
const Coin = ({ bg, children, size = 40 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
    {bg && <circle cx="20" cy="20" r="20" fill={bg} />}
    {children}
  </svg>
);

/** 文字标：所有字形都用 ASCII，避免 ₿ / Ð / Ξ 这类符号在部分安卓字体里缺字 */
const Glyph = ({ children, y = 20, size: fs = 17, fill = '#fff' }) => (
  <text x="20" y={y} textAnchor="middle" dominantBaseline="central"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"
        fontSize={fs} fontWeight="800" fill={fill} letterSpacing="-0.5">
    {children}
  </text>
);

// ---- BNB（官方现行标志：金黄圆底 + 菱形组合） ----
const BnbMark = ({ size = 40, bg = '#F0B90B' }) => (
  <Coin bg={bg} size={size}>
    <g transform="translate(4.6 4.6) scale(0.01234)">
      <path fill="#FFFFFF" d="M685.9,1248l0.9,330l280.4,165v193.2l-444.5-260.7v-524L685.9,1248L685.9,1248z M685.9,918v192.3l-163.3-96.6V821.4l163.3-96.6l164.1,96.6L685.9,918L685.9,918z M1084.3,821.4l163.3-96.6l164.1,96.6L1247.6,918L1084.3,821.4L1084.3,821.4z" />
      <path fill="#FFFFFF" d="M803.9,1509.6v-193.2l163.3,96.6v192.3L803.9,1509.6L803.9,1509.6z M1084.3,1812.2l163.3,96.6l164.1-96.6v192.3l-164.1,96.6l-163.3-96.6V1812.2L1084.3,1812.2z M1645.9,821.4l163.3-96.6l164.1,96.6v192.3l-164.1,96.6V918L1645.9,821.4L1645.9,821.4L1645.9,821.4z M1809.2,1578l0.9-330l163.3-96.6v524l-444.5,260.7v-193.2L1809.2,1578L1809.2,1578L1809.2,1578z" />
      <polygon fill="#FFFFFF" points="1692.1,1509.6 1528.8,1605.3 1528.8,1413 1692.1,1316.4 1692.1,1509.6" />
      <path fill="#FFFFFF" d="M1692.1,986.4l0.9,193.2l-281.2,165v330.8l-163.3,95.7l-163.3-95.7v-330.8l-281.2-165V986.4L968,889.8l279.5,165.8l281.2-165.8l164.1,96.6H1692.1L1692.1,986.4z M803.9,656.5l443.7-261.6l444.5,261.6l-163.3,96.6l-281.2-165.8L967.2,753.1L803.9,656.5L803.9,656.5z" />
    </g>
  </Coin>
);

// ---- USDT（Tether 官方现行六边形标志，宽高比 339:295） ----
const UsdtMark = ({ size = 40 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
    <g transform="translate(2.2 4.7) scale(0.106)">
      <path fill="#50AF95" fillRule="evenodd" d="M62.15,1.45l-61.89,130a2.52,2.52,0,0,0,.54,2.94L167.95,294.56a2.55,2.55,0,0,0,3.53,0L338.63,134.4a2.52,2.52,0,0,0,.54-2.94l-61.89-130A2.5,2.5,0,0,0,275,0H64.45a2.5,2.5,0,0,0-2.3,1.45h0Z" />
      <path fill="#fff" fillRule="evenodd" d="M191.19,144.8v0c-1.2.09-7.4,0.46-21.23,0.46-11,0-18.81-.33-21.55-0.46v0c-42.51-1.87-74.24-9.27-74.24-18.13s31.73-16.25,74.24-18.15v28.91c2.78,0.2,10.74.67,21.74,0.67,13.2,0,19.81-.55,21-0.66v-28.9c42.42,1.89,74.08,9.29,74.08,18.13s-31.65,16.24-74.08,18.12h0Zm0-39.25V79.68h59.2V40.23H89.21V79.68H148.4v25.86c-48.11,2.21-84.29,11.74-84.29,23.16s36.18,20.94,84.29,23.16v82.9h42.78V151.83c48-2.21,84.12-11.73,84.12-23.14s-36.09-20.93-84.12-23.15h0Z" />
    </g>
  </svg>
);

// ---- USDC（Circle 官方：蓝底白 $ + 两侧弧线） ----
const UsdcMark = ({ size = 40 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
    <g transform="scale(1.25)">
      <circle fill="#2775CA" cx="16" cy="16" r="16" />
      <path fill="#FFF" d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.243-2.193-.728-2.193-1.578 0-.85.61-1.396 1.828-1.396 1.097 0 1.707.364 2.011 1.275a.458.458 0 00.427.303h.975a.416.416 0 00.427-.425v-.06a3.04 3.04 0 00-2.743-2.489V9.142c0-.243-.183-.425-.487-.486h-.915c-.243 0-.426.182-.487.486v1.396c-1.829.242-2.986 1.456-2.986 2.974 0 2.002 1.218 2.791 3.778 3.095 1.707.303 2.255.668 2.255 1.639 0 .97-.853 1.638-2.011 1.638-1.585 0-2.133-.667-2.316-1.578-.06-.242-.244-.364-.427-.364h-1.036a.416.416 0 00-.426.425v.06c.243 1.518 1.219 2.61 3.23 2.914v1.457c0 .242.183.425.487.485h.915c.243 0 .426-.182.487-.485V21.34c1.829-.303 3.047-1.578 3.047-3.217z" />
      <path fill="#FFF" d="M12.892 24.497c-4.754-1.7-7.192-6.98-5.424-11.653.914-2.55 2.925-4.491 5.424-5.402.244-.121.365-.303.365-.607v-.85c0-.242-.121-.424-.365-.485-.061 0-.183 0-.244.06a10.895 10.895 0 00-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102.244.121.488 0 .548-.243.061-.06.061-.122.061-.243v-.85c0-.182-.182-.424-.365-.546zm6.46-18.936c-.244-.122-.488 0-.548.242-.061.061-.061.122-.061.243v.85c0 .243.182.485.365.607 4.754 1.7 7.192 6.98 5.424 11.653-.914 2.55-2.925 4.491-5.424 5.402-.244.121-.365.303-.365.607v.85c0 .242.121.424.365.485.061 0 .183 0 .244-.06a10.895 10.895 0 007.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162z" />
    </g>
  </svg>
);

// ---- UFO（本站贸易币） ----
const UfoMark = ({ size = 40 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
    <defs>
      <linearGradient id="ufo-icon-body" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <linearGradient id="ufo-icon-glass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#e0f2fe" />
        <stop offset="100%" stopColor="#bae6fd" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="#eff6ff" />
    <path d="M 27 54 C 27 18, 73 18, 73 54 Z" fill="url(#ufo-icon-glass)" stroke="#3b82f6" strokeWidth="3.5" />
    <ellipse cx="50" cy="56" rx="38" ry="14" fill="url(#ufo-icon-body)" />
    <circle cx="37" cy="56" r="3.6" fill="#fff" />
    <circle cx="50" cy="58" r="3.6" fill="#fff" />
    <circle cx="63" cy="56" r="3.6" fill="#fff" />
  </svg>
);

// ---- BTCB（Bitcoin 官方配色 + ₿） ----
const BtcbMark = ({ size = 40 }) => (
  <Coin bg="#F7931A" size={size}>
    <Glyph y={20.5} size={18}>B</Glyph>
    <rect x="17.4" y="7.5" width="1.7" height="4" rx="0.7" fill="#fff" />
    <rect x="21" y="7.5" width="1.7" height="4" rx="0.7" fill="#fff" />
    <rect x="17.4" y="28.5" width="1.7" height="4" rx="0.7" fill="#fff" />
    <rect x="21" y="28.5" width="1.7" height="4" rx="0.7" fill="#fff" />
  </Coin>
);

// ---- ETH（Binance-Peg Ethereum：宝石切割面） ----
const EthMark = ({ size = 40 }) => (
  <Coin bg="#627EEA" size={size}>
    <g fill="#fff">
      <path d="M20 6.5 13 20.2 20 24.2 27 20.2z" opacity="0.75" />
      <path d="M20 6.5 13 20.2 20 24.2z" />
      <path d="M20 26.1 13 22.1 20 33.5 27 22.1z" opacity="0.75" />
      <path d="M20 26.1 13 22.1 20 33.5z" />
    </g>
  </Coin>
);

// ---- CAKE（PancakeSwap 兔子：青色底 + 深棕兔头） ----
const CakeMark = ({ size = 40 }) => (
  <Coin bg="#1FC7D4" size={size}>
    <g fill="#633001">
      <ellipse cx="15.2" cy="12.6" rx="2.8" ry="7.6" transform="rotate(-16 15.2 12.6)" />
      <ellipse cx="24.8" cy="12.6" rx="2.8" ry="7.6" transform="rotate(16 24.8 12.6)" />
      <circle cx="20" cy="23.4" r="9.4" />
    </g>
    <circle cx="16.7" cy="22" r="1.55" fill="#1FC7D4" />
    <circle cx="23.3" cy="22" r="1.55" fill="#1FC7D4" />
    <path d="M20 25.7c1.5 0 2.6-.8 2.6-1.2h-5.2c0 .4 1.1 1.2 2.6 1.2z" fill="#fff" />
  </Coin>
);

// ---- BUSD（BSC 原生美元：金色 + $） ----
const BusdMark = ({ size = 40 }) => (
  <Coin bg="#F0B90B" size={size}>
    <Glyph size={21}>$</Glyph>
  </Coin>
);

const FdusdMark = ({ size = 40 }) => (
  <Coin bg="#0F9D8F" size={size}>
    <Glyph size={18}>FD</Glyph>
  </Coin>
);

// ---- LINK（Chainlink 六边立方） ----
const LinkMark = ({ size = 40 }) => (
  <Coin bg="#2A5ADA" size={size}>
    <path d="M20 8.5 29.5 14v12L20 31.5 10.5 26V14z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M20 14.2 25 17v6l-5 2.8L15 23v-6z" fill="#fff" />
  </Coin>
);

// ---- DOT（Polkadot：中心点 + 环） ----
const DotMark = ({ size = 40 }) => (
  <Coin bg="#E6007A" size={size}>
    <g fill="#fff">
      <circle cx="20" cy="20" r="3.4" />
      <circle cx="20" cy="10.6" r="2.4" />
      <circle cx="28.1" cy="15.3" r="2.4" />
      <circle cx="28.1" cy="24.7" r="2.4" />
      <circle cx="20" cy="29.4" r="2.4" />
      <circle cx="11.9" cy="24.7" r="2.4" />
      <circle cx="11.9" cy="15.3" r="2.4" />
    </g>
  </Coin>
);

// ---- XRP ----
const XrpMark = ({ size = 40 }) => (
  <Coin bg="#23292F" size={size}>
    <path d="M11.5 12c2.6 3 5.2 5.6 8.5 8.7 3.3-3.1 5.9-5.7 8.5-8.7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M11.5 28c2.6-3 5.2-5.6 8.5-8.7 3.3 3.1 5.9 5.7 8.5 8.7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
  </Coin>
);

// ---- DOGE（Binance-Peg Dogecoin） ----
const DogeMark = ({ size = 40 }) => (
  <Coin bg="#C2A633" size={size}>
    <Glyph size={18}>D</Glyph>
    <rect x="17.6" y="15.2" width="6.4" height="1.8" rx="0.9" fill="#fff" />
  </Coin>
);

const DaiMark = ({ size = 40 }) => (
  <Coin bg="#F5AC37" size={size}>
    <Glyph size={18} fill="#1E1E1E">D</Glyph>
  </Coin>
);

const ShibMark = ({ size = 40 }) => (
  <Coin bg="#F00500" size={size}>
    <Glyph size={18}>S</Glyph>
  </Coin>
);

const ICONS = {
  BNB: BnbMark,
  WBNB: BnbMark,
  USDT: UsdtMark,
  USDC: UsdcMark,
  UFO: UfoMark,
  BTCB: BtcbMark,
  ETH: EthMark,
  CAKE: CakeMark,
  BUSD: BusdMark,
  FDUSD: FdusdMark,
  LINK: LinkMark,
  DOT: DotMark,
  XRP: XrpMark,
  DOGE: DogeMark,
  DAI: DaiMark,
  SHIB: ShibMark
};

/** 优先用 token.logoURI（若项目以后接 token list），否则用内置矢量图 */
export function TokenIcon({ token, size = 40 }) {
  if (!token) return null;
  if (token.logoURI) {
    return (
      <img src={token.logoURI} width={size} height={size} alt=""
           style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'block' }} />
    );
  }
  const Mark = ICONS[token.symbol] || BnbMark;
  return <Mark size={size} />;
}

export { BnbMark as BnbIcon, UfoMark as UfoIcon };
