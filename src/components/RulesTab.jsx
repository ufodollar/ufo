import React from 'react';

/* ============================================================
   🎨 Cartoon Icon Set — 粗描边 / 圆角 / 卡通感
   ============================================================ */
const CartoonIcon = ({ type }) => {
  const base = {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (type) {
    /* 🌍 地球 */
    case 'globe':
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9z" />
        </svg>
      );

    /* 🔒 锁 */
    case 'lock':
      return (
        <svg {...base}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15.5" r="1.4" />
        </svg>
      );

    /* ⚖️ 天平 */
    case 'scale':
      return (
        <svg {...base}>
          <path d="M12 3.5v16" />
          <path d="M6 20h12" />
          <path d="M4.5 7.5h15" />
          <path d="M7.5 7.5 4 14.5a3.5 3.5 0 0 0 7 0L7.5 7.5z" />
          <path d="M16.5 7.5 13 14.5a3.5 3.5 0 0 0 7 0l-3.5-7z" />
        </svg>
      );

    /* 🛡️ 盾牌 */
    case 'shield':
      return (
        <svg {...base}>
          <path d="M12 3 5 5.8v5.4c0 4.6 3 8.2 7 9.8 4-1.6 7-5.2 7-9.8V5.8L12 3z" />
          <path d="m8.8 12 2.2 2.2 4.2-4.4" />
        </svg>
      );

    /* ⚡ 闪电 */
    case 'zap':
      return (
        <svg {...base}>
          <path d="M13 2.5 5.5 13.5h5.2L9.5 21.5l7.5-11h-5.2l1.2-8z" />
        </svg>
      );

    /* 🧱 分层 */
    case 'layers':
      return (
        <svg {...base}>
          <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3z" />
          <path d="m3.5 12 8.5 4.5 8.5-4.5" />
          <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
        </svg>
      );

    /* ⚠️ 警告 */
    case 'alert':
      return (
        <svg {...base}>
          <path d="M12.9 3.6a1 1 0 0 0-1.8 0L2.6 18.3a1 1 0 0 0 .9 1.5h17a1 1 0 0 0 .9-1.5L12.9 3.6z" />
          <path d="M12 9.5v4" />
          <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    default:
      return null;
  }
};

/* ============================================================
   🧩 卡片外壳
   ============================================================ */
const Card = ({ title, icon, gradient, glow, children }) => (
  <div
    style={{
      position: 'relative',
      overflow: 'hidden',
      isolation: 'isolate',
      padding: '22px 22px 24px',
      borderRadius: '28px',
      background: gradient,
      color: '#ffffff',
      boxShadow: `0 22px 45px -24px ${glow}, inset 0 1px 0 rgba(255,255,255,0.22)`,
    }}
  >
    {/* 装饰光斑 · 右上 */}
    <span
      style={{
        position: 'absolute',
        top: '-48px',
        right: '-38px',
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(255,255,255,0.30), rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
      }}
    />
    {/* 装饰光斑 · 左下 */}
    <span
      style={{
        position: 'absolute',
        bottom: '-64px',
        left: '-46px',
        width: '160px',
        height: '160px',
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(255,255,255,0.16), rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
      }}
    />

    {/* 顶部：标题胶囊 + 右上角卡通图标 */}
    <div
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          fontSize: '10.5px',
          fontWeight: 800,
          letterSpacing: '1.6px',
          textTransform: 'uppercase',
          lineHeight: 1.35,
          color: 'rgba(255,255,255,0.95)',
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.30)',
          padding: '7px 12px',
          borderRadius: '999px',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {title}
      </div>

      <div
        style={{
          flexShrink: 0,
          width: '48px',
          height: '48px',
          borderRadius: '17px',
          display: 'grid',
          placeItems: 'center',
          color: '#ffffff',
          background: 'rgba(255,255,255,0.20)',
          border: '1px solid rgba(255,255,255,0.40)',
          boxShadow:
            '0 10px 20px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.55)',
          transform: 'rotate(-4deg)',
        }}
      >
        <CartoonIcon type={icon} />
      </div>
    </div>

    {/* 正文 */}
    <div style={{ position: 'relative' }}>{children}</div>
  </div>
);

/* ============================================================
   📐 通用文字样式
   ============================================================ */
const cardTitle = {
  fontSize: '18px',
  fontWeight: 800,
  lineHeight: 1.38,
  letterSpacing: '-0.2px',
  marginBottom: '10px',
};

const cardText = {
  fontSize: '14px',
  lineHeight: 1.7,
  color: 'rgba(255,255,255,0.92)',
};

/* ============================================================
   🚀 RulesTab
   ============================================================ */
export default function RulesTab() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginTop: '10px',
        paddingBottom: '12px',
      }}
    >
      {/* ================= 1. 核心介绍 · 地球图标 ================= */}
      <Card
        title="Value-Invisible Trade Settlement"
        icon="globe"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <h3 style={{ ...cardTitle, fontSize: '21px' }}>
          Specifically designed for concealing stablecoin assets and private crypto commercial settlement.
        </h3>

        <p style={cardText}>
          UFO is a USD-pegged stablecoin engineered for absolute asset protection. By avoiding public exchange listings, standard wallets display its fiat value as <b>$0.00</b>. This acts as a powerful physical camouflage against extortion and automated wallet-draining bots.
        </p>

        <div
          style={{
            marginTop: '16px',
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.24)',
            padding: '14px 16px',
            borderRadius: '18px',
            fontSize: '13.5px',
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.95)',
          }}
        >
          <b>How it works:</b> Mint UFO with USDT/USDC and send it to your commercial partners. They can seamlessly redeem it for stablecoins, bypassing the friction and exposure of traditional transfers.
        </div>

        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255,255,255,0.25)',
            fontSize: '13px',
            fontWeight: 600,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.90)',
          }}
        >
          🌍 Currently widely used in over 60 countries globally for cryptocurrency security and commercial settlement.
        </div>
      </Card>

      {/* ================= 2. 资产伪装 · 锁图标 ================= */}
      <Card
        title="Asset Camouflage"
        icon="lock"
        gradient="linear-gradient(145deg, #475569 0%, #334155 55%, #1e293b 100%)"
        glow="rgba(51,65,85,0.50)"
      >
        <h4 style={cardTitle}>Unobtrusive Transfers & Settlement.</h4>
        <p style={cardText}>
          Operating as a closed-loop network with no public DEX liquidity pools. When you send or receive UFO in mainstream wallets, bystanders and automated trackers only see a transfer of a $0.00 asset.
        </p>
      </Card>

      {/* ================= 3. Trusted UFO · 天平图标 ================= */}
      <Card
        title="Trusted UFO"
        icon="scale"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <p style={cardText}>
          UFO is a regulated digital asset issued in 2023 by Stone X, a regulated financial services firm strictly adhering to U.S. laws and standards to safeguard your funds. Each UFO is fully backed 1:1 by USD or cash equivalents from Stone X's public reserves, with monthly attestations provided by one of the Big Four accounting firms. We provide this level of transparency to demonstrate our commitment to accountability—trust verifiable facts, not empty promises.
        </p>
      </Card>

      {/* ================= 4. 严格锚定 · 盾牌图标 ================= */}
      <Card
        title="Strict 1:1 Peg to USD"
        icon="shield"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <h4 style={cardTitle}>Rigid USD peg. Stablecoins priced via Chainlink.</h4>
        <p style={cardText}>
          UFO is rigidly pegged to the US Dollar. USDT and USDC are <b>not</b> treated as $1.00 — their live Chainlink USD prices are read on-chain by the Vault contract itself. If a stablecoin deviates more than 2% from $1, transactions revert automatically.
        </p>
      </Card>

      {/* ================= 5. 即时结算 · 闪电图标 ================= */}
      <Card
        title="Instant Settlement"
        icon="zap"
        gradient="linear-gradient(145deg, #f59e0b 0%, #ea580c 60%, #c2410c 100%)"
        glow="rgba(234,88,12,0.50)"
      >
        <h4 style={cardTitle}>24/7 Global Fund Clearing.</h4>
        <p style={cardText}>
          Send money like a message. With UFO, cross-border funds arrive in the recipient's wallet within seconds, bypassing traditional banking delays.
        </p>
      </Card>

      {/* ================= 6. 安全与合规 · 分层图标 ================= */}
      <Card
        title="Security & Compliance"
        icon="layers"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <h4 style={cardTitle}>Cryptographically tamper-proof.</h4>
        <p style={cardText}>
          Vault reserves are transparent and verifiable on BscScan. Every transaction is secured by blockchain-level cryptography.
        </p>
      </Card>

      {/* ================= 7. 免责声明 · 警告图标 ================= */}
      <Card
        title="Disclaimer"
        icon="alert"
        gradient="linear-gradient(145deg, #fb7185 0%, #ec4899 52%, #be185d 100%)"
        glow="rgba(236,72,153,0.50)"
      >
        <h4 style={cardTitle}>A payment instrument, not an investment.</h4>
        <p style={cardText}>
          UFO does not offer yields or speculative returns. Users are solely responsible for ensuring their use of the protocol complies with local laws. UFO is not offered to persons in restricted jurisdictions including the <b>United States, Mainland China, Iran, North Korea, Syria, Cuba, Venezuela, Russia, and Belarus</b>.
        </p>
      </Card>
    </div>
  );
}