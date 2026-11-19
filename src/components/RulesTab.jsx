import React from 'react';

/* ============================================================
   主题色板（每个卡片一组渐变色）
   ============================================================ */
const CARD = {
  intro:      { from: '#2563eb', to: '#06b6d4' }, // 正蓝 → 天青
  trusted:    { from: '#059669', to: '#10b981' }, // 深翠 → 薄荷
  instant:    { from: '#ea580c', to: '#f59e0b' }, // 橙红 → 琥珀
  security:   { from: '#7c3aed', to: '#a855f7' }, // 靛紫 → 紫罗兰
  disclaimer: { from: '#475569', to: '#64748b' }, // 岩灰 → 雾灰
};

/* ============================================================
   图标（统一线条风格，24 网格）
   ============================================================ */
const ICON_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Icon = ({ type, size = 26 }) => {
  const shapes = {
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <ellipse cx="12" cy="12" rx="4.5" ry="9" />
      </>
    ),
    dollar: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    shield: (
      <>
        <path d="M12 22s8-3.6 8-10V5.5L12 2.5 4 5.5V12c0 6.4 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    alert: (
      <>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...ICON_PROPS} aria-hidden="true">
      {shapes[type]}
    </svg>
  );
};

/* ============================================================
   卡片数据（已合并去重：Reserve 与 Peg 合为一条）
   ============================================================ */
const CARDS = [
  {
    key: 'intro',
    icon: 'globe',
    title: 'Core Positioning',
    text: 'Value-stealth trade settlement. Built to conceal stablecoin assets and enable unassuming, private transfers.',
  },
  {
    key: 'trusted',
    icon: 'dollar',
    title: 'Trusted 1:1 Reserve',
    text: '1:1 reserve backed by USD equivalents, attested monthly by a Big Four firm. A rigid USD peg is enforced via Chainlink — transactions revert if the price deviates over 2%.',
  },
  {
    key: 'instant',
    icon: 'zap',
    title: 'Instant Settlement',
    text: '24/7 global fund clearing. Cross-border funds arrive in seconds.',
  },
  {
    key: 'security',
    icon: 'shield',
    title: 'Security & Compliance',
    text: 'Cryptographically tamper-proof and fully verifiable on BscScan.',
  },
  {
    key: 'disclaimer',
    icon: 'alert',
    title: 'Disclaimer',
    text: 'A payment instrument, not an investment. Not offered in restricted jurisdictions.',
  },
];

/* ============================================================
   右上角图标容器样式
   ============================================================ */
const badgeStyle = {
  position: 'absolute',
  top: 18,
  right: 18,
  width: 46,
  height: 46,
  borderRadius: 15,
  display: 'grid',
  placeItems: 'center',
  color: '#ffffff',
  background: 'rgba(255, 255, 255, 0.18)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  zIndex: 1,
};

/* ============================================================
   单个卡片
   ============================================================ */
const RuleCard = ({ item }) => {
  const theme = CARD[item.key];

  return (
    <article
      className="ufo-rule-card"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 26,
        padding: '22px 22px 24px',
        color: '#ffffff',
        background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
        boxShadow: `0 20px 38px -22px ${theme.from}, 0 4px 12px -8px rgba(15, 23, 42, 0.35)`,
      }}
    >
      {/* 右上角装饰光斑 */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -70,
          right: -60,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      {/* 左下角暗角，增加层次 */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -90,
          left: -60,
          width: 170,
          height: 170,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 右上角图标 */}
      <span style={badgeStyle}>
        <Icon type={item.icon} />
      </span>

      {/* 文案 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h4
          style={{
            margin: '0 0 10px',
            paddingRight: 70,
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
          }}
        >
          {item.title}
        </h4>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.92)',
          }}
        >
          {item.text}
        </p>
      </div>
    </article>
  );
};

/* ============================================================
   页面
   ============================================================ */
export default function RulesTab() {
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: '#f8fafc',
        padding: '20px 16px 40px',
      }}
    >
      <style>{`
        .ufo-rule-card {
          transition: transform 220ms ease, box-shadow 220ms ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .ufo-rule-card:hover {
            transform: translateY(-3px);
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {CARDS.map((item) => (
          <RuleCard key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}