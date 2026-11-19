import React from 'react';

const RuleIcon = ({ type }) => {
  const icons = {
    globe: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    safe: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>,
    shield: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    eye: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    layers: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    zap: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    lock: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    alert: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    // 天平图标
    scale: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M5 21h14"/><path d="M3 7h18"/><path d="M7 7l-4 8a4 4 0 0 0 8 0L7 7z"/><path d="M17 7l-4 8a4 4 0 0 0 8 0l-4-8z"/></svg>
  };
  return icons[type] || null;
};

const CardHeader = ({ title, iconType, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
    <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: accent || 'rgba(255,255,255,0.7)', marginTop: '6px' }}>{title}</div>
    <div style={{ color: accent || 'rgba(255,255,255,0.8)' }}><RuleIcon type={iconType} /></div>
  </div>
);

export default function RulesTab() {
  const GOLD = '#D4AF37';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>

      {/* 1. 核心介绍 */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,58,138,0.3)' }}>
        <CardHeader title="Value-Invisible Trade Settlement" iconType="eye" />
        <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px' }}>专为隐藏稳定币资产和全球贸易隐形结算而设计</h3>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is a USD-pegged stablecoin engineered for absolute asset protection. By avoiding public exchange listings, standard wallets display its fiat value as <b>$0.00</b>. This acts as a powerful physical camouflage against extortion and automated wallet-draining bots.</p>
        <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', fontSize: '14px', lineHeight: 1.6 }}>
          <b>How it works:</b> Mint UFO with USDT/USDC and send it to your commercial partners. They can seamlessly redeem it for stablecoins, bypassing the friction and exposure of traditional transfers.
        </div>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>
          🌍 目前在全球60多个国家广泛用于全球贸易隐形结算。
        </div>
      </div>

      {/* 2. 资产伪装 */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b, #475569)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,41,59,0.3)' }}>
        <CardHeader title="Asset Camouflage" iconType="lock" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Unobtrusive Transfers & Settlement.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Operating as a closed-loop network with no public DEX liquidity pools. When you send or receive UFO in mainstream wallets, bystanders and automated trackers only see a transfer of a $0.00 asset.</p>
      </div>

      {/* 3. Trusted UFO (藏青 + 暗金 / 审计机构配色) */}
      <div style={{ position: 'relative', background: 'linear-gradient(135deg, #0b2545 0%, #123a63 58%, #8a6d1f 100%)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(11,37,69,0.45)', borderTop: `2px solid rgba(212,175,55,0.55)` }}>
        <CardHeader title="Trusted UFO" iconType="scale" accent={GOLD} />
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
          UFO is a regulated digital asset issued in 2023 by Stone X, a regulated financial services firm strictly adhering to U.S. laws and standards to safeguard your funds. Each UFO is fully backed 1:1 by USD or cash equivalents from Stone X's public reserves, with monthly attestations provided by one of the Big Four accounting firms. We provide this level of transparency to demonstrate our commitment to accountability—trust verifiable facts, not empty promises.
        </p>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(212,175,55,0.35)', fontSize: '12px', fontWeight: '700', letterSpacing: '1px', color: 'rgba(212,175,55,0.9)' }}>
          1:1 RESERVE BACKED · MONTHLY ATTESTED
        </div>
      </div>

      {/* 4. 严格锚定 (墨绿/银行权威色) */}
      <div style={{ background: 'linear-gradient(135deg, #064e3b, #047857)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(6,78,59,0.3)' }}>
        <CardHeader title="Strict 1:1 Peg to USD" iconType="shield" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Rigid USD peg. Stablecoins priced via Chainlink.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is rigidly pegged to the US Dollar. USDT and USDC are <b>not</b> treated as $1.00 — their live Chainlink USD prices are read on-chain by the Vault contract itself. If a stablecoin deviates more than 2% from $1, transactions revert automatically.</p>
      </div>

      {/* 5. 即时结算 */}
      <div style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(180,83,9,0.3)' }}>
        <CardHeader title="Instant Settlement" iconType="zap" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>24/7 Global Fund Clearing.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Send money like a message. With UFO, cross-border funds arrive in the recipient's wallet within seconds, bypassing traditional banking delays.</p>
      </div>

      {/* 6. 安全与合规 */}
      <div style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(67,56,202,0.3)' }}>
        <CardHeader title="Security & Compliance" iconType="layers" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Cryptographically tamper-proof.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Vault reserves are transparent and verifiable on BscScan. Every transaction is secured by blockchain-level cryptography.</p>
      </div>

      {/* 7. 免责声明 */}
      <div style={{ background: 'linear-gradient(135deg, #db2777, #f472b6)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(219,39,119,0.3)' }}>
        <CardHeader title="Disclaimer" iconType="alert" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>A payment instrument, not an investment.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO does not offer yields or speculative returns. Users are solely responsible for ensuring their use of the protocol complies with local laws. UFO is not offered to persons in restricted jurisdictions including the <b>United States, Mainland China, Iran, North Korea, Syria, Cuba, Venezuela, Russia, and Belarus</b>.</p>
      </div>

    </div>
  );
}
