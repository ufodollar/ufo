const CARD = {
  intro: '#0055ff',       // 1. 正蓝色
  trusted: '#ff4d2e',      // 2. 番茄红
  peg: '#ff8800',         // 3. 橙色
  instant: '#ffd500',      // 4. 黄色
  security: '#00bfa6',     // 5. 青色
  disclaimer: '#7b1fa2'    // 6. 紫色
};

// 图标组件 (保持右上角卡通线条图标)
const Icon = ({ type }) => {
  const props = { width: 28, height: 28, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    globe: <circle cx="12" cy="12" r="10" {...props} /><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" {...props} />,
    eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...props} /><circle cx="12" cy="12" r="3" {...props} />,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" {...props} />,
    dollar: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" {...props} />,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...props} />,
    lock: <rect x="3" y="11" width="18" height="11" rx="2" ry="2" {...props} /><path d="M7 11V7a5 5 0 0110 0v4" {...props} />,
    alert: <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" {...props} /><line x1="12" y1="9" x2="12" y2="13" {...props} /><line x1="12" y1="17" x2="12.01" y2="17" {...props} />
  };
  return <svg viewBox="0 0 24 24" {...props}>{paths[type]}</svg>;
};

// 卡片标题组件
const CardTitle = ({ children }) => (
  <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>{children}</h4>
);

// 渲染卡片数组 (去重合并后的7项数据)
const cardsData = [
  { bg: CARD.intro, title: 'Core Positioning', icon: 'globe', content: 'Value-stealth trade settlement. Designed to hide stablecoin assets.' },
  { bg: CARD.trusted, title: 'Trusted UFO', icon: 'eye', content: '1:1 reserve backed by USD equivalents. Monthly attested by a Big Four firm.' },
  { bg: CARD.peg, title: 'Strict 1:1 Peg to USD', icon: 'dollar', content: 'Rigid USD peg, priced via Chainlink. Transactions revert if deviating over 2%.' },
  { bg: CARD.instant, title: 'Instant Settlement', icon: 'zap', content: '24/7 global fund clearing. Cross-border funds arrive in seconds.' },
  { bg: CARD.security, title: 'Security & Compliance', icon: 'lock', content: 'Cryptographically tamper-proof. Verifiable on BscScan.' },
  { bg: CARD.disclaimer, title: 'Disclaimer', icon: 'alert', content: 'A payment instrument, not an investment. Not offered in restricted jurisdictions.' }
];

// 页面主结构
<div style={{ background: '#ffffff', padding: '20px', margin: 0 }}>
  <div style={{ maxWidth: '800px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
    
    {cardsData.map((c, i) => (
      <article key={i} style={{ position: 'relative', background: c.bg, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}><Icon type={c.icon} /></div>
        <CardTitle>{c.title}</CardTitle>
        <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>{c.content}</p>
      </article>
    ))}

  </div>
</div>
