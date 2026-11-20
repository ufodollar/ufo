import React from 'react';

/* ============================================================
   🎨 Cartoon Icon Set — 粗描边 / 圆角 / 卡通感
   GuideTab 与 RulesTab 共用，保证两页视觉完全一致
   ============================================================ */
export const CartoonIcon = ({ type, size = 26 }) => {
  const base = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (type) {
    case 'globe':
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9z" />
        </svg>
      );

    case 'lock':
      return (
        <svg {...base}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          <circle cx="12" cy="15.5" r="1.4" />
        </svg>
      );

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

    case 'shield':
      return (
        <svg {...base}>
          <path d="M12 3 5 5.8v5.4c0 4.6 3 8.2 7 9.8 4-1.6 7-5.2 7-9.8V5.8L12 3z" />
          <path d="m8.8 12 2.2 2.2 4.2-4.4" />
        </svg>
      );

    case 'zap':
      return (
        <svg {...base}>
          <path d="M13 2.5 5.5 13.5h5.2L9.5 21.5l7.5-11h-5.2l1.2-8z" />
        </svg>
      );

    case 'layers':
      return (
        <svg {...base}>
          <path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3z" />
          <path d="m3.5 12 8.5 4.5 8.5-4.5" />
          <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
        </svg>
      );

    case 'alert':
      return (
        <svg {...base}>
          <path d="M12.9 3.6a1 1 0 0 0-1.8 0L2.6 18.3a1 1 0 0 0 .9 1.5h17a1 1 0 0 0 .9-1.5L12.9 3.6z" />
          <path d="M12 9.5v4" />
          <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    /* 💳 钱包 */
    case 'wallet':
      return (
        <svg {...base}>
          <path d="M20 8.5V6.8a1.8 1.8 0 0 0-1.8-1.8H5.5a1.5 1.5 0 0 0 0 3h13" />
          <rect x="3.6" y="8.5" width="16.8" height="10.9" rx="2.6" />
          <circle cx="16.4" cy="14" r="1.2" />
        </svg>
      );

    /* 🔁 兑换 */
    case 'exchange':
      return (
        <svg {...base}>
          <path d="M4 8.5h13l-3.2-3.2" />
          <path d="M20 15.5H7l3.2 3.2" />
        </svg>
      );

    /* 📈 净值 / 行情 */
    case 'trend':
      return (
        <svg {...base}>
          <path d="M3.5 19.5h17" />
          <path d="M5.5 15.5 9.8 11l3 2.6L20 6.4" />
          <path d="M16.2 6.4H20v3.8" />
        </svg>
      );

    /* 🔌 连接 */
    case 'plug':
      return (
        <svg {...base}>
          <path d="M9 3.5v5" />
          <path d="M15 3.5v5" />
          <path d="M6.5 8.5h11v2.7a5.5 5.5 0 0 1-5.5 5.5 5.5 5.5 0 0 1-5.5-5.5V8.5z" />
          <path d="M12 16.7v3.8" />
        </svg>
      );

    /* ℹ️ 说明 */
    case 'info':
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5" />
          <circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none" />
        </svg>
      );

    default:
      return null;
  }
};

/* ============================================================
   🧩 卡片外壳
   ============================================================ */
export const Card = ({ title, icon, gradient, glow, children }) => (
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
   📦 卡内嵌块（说明 / 步骤 / 提示）
   ============================================================ */
export const Panel = ({ children, style }) => (
  <div
    style={{
      marginTop: '14px',
      background: 'rgba(255,255,255,0.14)',
      border: '1px solid rgba(255,255,255,0.24)',
      padding: '14px 16px',
      borderRadius: '18px',
      fontSize: '13.5px',
      lineHeight: 1.7,
      color: 'rgba(255,255,255,0.95)',
      ...style,
    }}
  >
    {children}
  </div>
);

/* ============================================================
   📐 通用文字样式
   ============================================================ */
export const cardTitle = {
  fontSize: '18px',
  fontWeight: 800,
  lineHeight: 1.38,
  letterSpacing: '-0.2px',
  marginBottom: '10px',
};

export const cardText = {
  fontSize: '14px',
  lineHeight: 1.7,
  color: 'rgba(255,255,255,0.92)',
};

export const divider = {
  marginTop: '16px',
  paddingTop: '14px',
  borderTop: '1px solid rgba(255,255,255,0.25)',
  fontSize: '13px',
  fontWeight: 600,
  lineHeight: 1.7,
  color: 'rgba(255,255,255,0.90)',
};

export const tabWrap = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  marginTop: '10px',
  paddingBottom: '12px',
};
