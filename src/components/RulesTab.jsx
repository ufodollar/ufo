import React from 'react';

// 卡片配色配置
const CARD = {
  intro: '#0369a1',      // 1. 天空深蓝 (替代天蓝)
  camouflage: '#7c3aed', // 2. 紫罗兰
  trusted: '#84cc16',    // 3. 时尚牛油果绿 (替代深海蓝/古金棕)
  peg: '#047857',        // 4. 墨绿
  instant: '#c2410c',     // 5. 赤陶橙
  security: '#0e7490',    // 6. 石板青
  disclaimer: '#0f1013'   // 7. 深黑色
};

// 卡通图标组件
const Icon = ({ type }) => {
  const icons = {
    earth: <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />,
    eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    dollar: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    lock: <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />,
    alert: <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  };
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[type]}
    </svg>
  );
};

// 卡片标题组件
const CardTitle = ({ children }) => (
  <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>{children}</h4>
);

export default function RulesTab() {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', margin: 0, padding: '16px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        
        {/* 1. Core Intro — 天空深蓝 + 地球图标 */}
        <article style={{ position: 'relative', background: CARD.intro, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(3,105,161,0.7)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type="earth" /></div>
          <CardTitle>Core Positioning</CardTitle>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            Value-stealth trade settlement. Designed to hide stablecoin assets and settle global trade invisibly.
          </p>
        </article>

        {/* 2. Asset Camouflage — 紫罗兰 + 眼睛图标 */}
        <article style={{ position: 'relative', background: CARD.camouflage, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(124,58,237,0.7)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type="eye" /></div>
          <CardTitle>Asset Camouflage</CardTitle>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            UFO mimics a $0.00 balance in standard wallets, providing physical camouflage against ransomware and sweepers.
          </p>
        </article>

        {/* 3. Trusted UFO — 时尚牛油果绿 + 盾牌图标 */}
        <article style={{ position: 'relative', background: CARD.trusted, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(132,204,22,0.7)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type="shield" /></div>
          <CardTitle>Trusted UFO</CardTitle>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            1:1 reserve backed by USD equivalents. Monthly attested by a Big Four firm.
          </p>
        </article>

        {/* 4. Strict Peg — 墨绿 + 美元图标 */}
        <article style={{ position: 'relative', background: CARD.peg, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(4,120,87,0.7)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type="dollar" /></div>
          <CardTitle>Strict 1:1 Peg to USD</CardTitle>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            Rigid USD peg, priced via Chainlink. Transactions revert if deviating over 2%.
          </p>
        </article>

        {/* 5. Instant Settlement — 赤陶橙 + 闪电图标 */}
        <article style={{ position: 'relative', background: CARD.instant, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(194,65,12,0.7)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type="zap" /></div>
          <CardTitle>Instant Settlement</CardTitle>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            24/7 global fund clearing. Cross-border funds arrive in seconds.
          </p>
        </article>

        {/* 6. Security & Compliance — 石板青 + 锁图标 */}
        <article style={{ position: 'relative', background: CARD.security, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(14,116,144,0.7)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type="lock" /></div>
          <CardTitle>Security &amp; Compliance</CardTitle>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
            Cryptographically tamper-proof. Verifiable on BscScan.
          </p>
        </article>

        {/* 7. Disclaimer — 深黑色 + 警告图标 */}
        <article style={{ position: 'relative', background: CARD.disclaimer, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(0,0,0,0.65)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type="alert" /></div>
          <CardTitle>Disclaimer</CardTitle>
          <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.88)', margin: 0 }}>
            A payment instrument, not an investment. Not offered in restricted jurisdictions.
          </p>
        </article>

      </div>
    </div>
  );
}
