// 重新调整的配色方案
const CARD = {
  intro: { bg: '#0055ff', text: '#ffffff' },       // 1. 正蓝色
  trusted: { bg: '#ff4d2e', text: '#ffffff' },     // 2. 番茄红
  peg: { bg: '#ff8800', text: '#ffffff' },         // 3. 橙色
  instant: { bg: '#eab308', text: '#1e293b' },     // 4. 金黄色（深色文字保证对比度）
  security: { bg: '#00bfa6', text: '#ffffff' },    // 5. 青色
  disclaimer: { bg: '#7b1fa2', text: '#ffffff' }   // 6. 紫色
};

// 图标组件 (保持右上角卡通线条图标)
const Icon = ({ type }) => {
  const props = { width: 28, height: 28, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    globe: <circle cx="12" cy="12" r="10" {...props} />,
    eye: <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" {...props} />,
    dollar: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" {...props} />,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...props} />,
    lock: <rect x="3" y="11" width="18" height="11" rx="2" ry="2" {...props} />,
    alert: <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" {...props} />
  };
  return <svg viewBox="0 0 24 24" {...props}>{paths[type]}</svg>;
};

// 卡片标题组件
const CardTitle = ({ children }) => (
  <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>{children}</h4>
);

// 渲染数据
const cardsData = [
  { key: 'intro', title: 'Core Positioning', icon: 'globe', content: 'Value-stealth trade settlement. Designed to hide stablecoin assets.' },
  { key: 'trusted', title: 'Trusted UFO', icon: 'eye', content: '1:1 reserve backed by USD equivalents. Monthly attested by a Big Four firm.' },
  { key: 'peg', title: 'Strict 1:1 Peg to USD', icon: 'dollar', content: 'Rigid USD peg, priced via Chainlink. Transactions revert if deviating over 2%.' },
  { key: 'instant', title: 'Instant Settlement', icon: 'zap', content: '24/7 global fund clearing. Cross-border funds arrive in seconds.' },
  { key: 'security', title: 'Security & Compliance', icon: 'lock', content: 'Cryptographically tamper-proof. Verifiable on BscScan.' },
  { key: 'disclaimer', title: 'Disclaimer', icon: 'alert', content: 'A payment instrument, not an investment. Not offered in restricted jurisdictions.' }
];

// 🟢 正确的组件导出结构
export default function RulesTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
      
      {cardsData.map((c) => {
        const theme = CARD[c.key];
        
        return (
          <article 
            key={c.key} 
            style={{ 
              position: 'relative', 
              background: theme.bg, 
              padding: '24px', 
              borderRadius: '24px', 
              color: theme.text, 
              boxShadow: `0 10px 30px -10px ${theme.bg}80`, // 动态生成与背景色匹配的阴影
              overflow: 'hidden' 
            }}
          >
            {/* 右上角图标 */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.8 }}>
              <Icon type={c.icon} />
            </div>
            
            <CardTitle>{c.title}</CardTitle>
            
            <p style={{ 
              fontSize: '14px', 
              lineHeight: 1.6, 
              color: theme.text, 
              opacity: 0.95, 
              margin: 0 
            }}>
              {c.content}
            </p>
          </article>
        );
      })}

    </div>
  );
}