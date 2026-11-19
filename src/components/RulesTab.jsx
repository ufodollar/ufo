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
    // Balance scale icon
    scale: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M5 21h14"/><path d="M3 7h18"/><path d="M7 7l-4 8a4 4 0 0 0 8 0L7 7z"/><path d="M17 7l-4 8a4 4 0 0 0 8 0l-4-8z"/></svg>
  };
  return icons[type] || null;
};

const CardHeader = ({ title, iconType, accent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
    <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: accent || 'rgba(255,255,255,0.72)', marginTop: '6px' }}>{title}</div>
    <div style={{ color: accent || 'rgba(255,255,255,0.82)' }}><RuleIcon type={iconType} /></div>
  </div>
);

export default function RulesTab() {
  const GOLD = '#D4AF37';

  // Solid palette: one distinct background per card, no gradients.
  const CARD = {
    intro: '#1e3a8a',      // deep navy blue
    camouflage: '#334155', // slate gray
    trusted: '#0b2545',    // midnight navy (gold accents)
    peg: '#065f46',        // deep emerald
    instant: '#b45309',    // burnt amber
    security: '#0e7490',   // teal cyan
    disclaimer: '#be185d'  // deep magenta
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>

      {/* 1. Core introduction */}
      <div style={{ background: CARD.intro, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,58,138,0.45)' }}>
        <CardHeader title="Value-Invisible Trade Settlement" iconType="eye" />
        <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px' }}>Specifically designed for concealing stablecoin assets and invisible global trade settlement.</h3>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is a USD-pegged stablecoin engineered for absolute asset protection. By avoiding public exchange listings, standard wallets display its fiat value as <b>$0.00</b>. This acts as a powerful physical camouflage against extortion and automated wallet-draining bots.</p>
        <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.12)', padding: '12px', borderRadius: '12px', fontSize: '14px', lineHeight: 1.6 }}>
          <b>How it works:</b> Mint UFO with USDT or USDC and send it to your commercial partners. They can seamlessly redeem it for stablecoins, bypassing the friction and exposure of traditional transfers.
        </div>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.22)', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.82)' }}>
          Currently widely used in over 60 countries worldwide for invisible global trade settlement.
        </div>
      </div>

      {/* 2. Asset camouflage */}
      <div style={{ background: CARD.camouflage, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,41,59,0.45)' }}>
        <CardHeader title="Asset Camouflage" iconType="lock" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Unobtrusive transfers and settlement.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>The protocol operates as a closed-loop network with no public DEX liquidity pools. When you send or receive UFO in mainstream wallets, bystanders and automated trackers only see a transfer of an asset valued at $0.00.</p>
      </div>

      {/* 3. Trusted UFO (midnight navy + gold accents) */}
      <div style={{ position: 'relative', background: CARD.trusted, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(11,37,69,0.55)', borderTop: '2px solid rgba(212,175,55,0.6)' }}>
        <CardHeader title="Trusted UFO" iconType="scale" accent={GOLD} />
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
          UFO is a regulated digital asset issued in 2023 by Stone X, a regulated financial services firm that adheres to U.S. laws and standards to safeguard your funds. Each UFO is fully backed 1:1 by USD or cash equivalents held in Stone X's public reserves, with monthly attestations provided by one of the Big Four accounting firms. We provide this level of transparency to demonstrate our commitment to accountability. Trust verifiable facts, not empty promises.
        </p>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(212,175,55,0.4)', fontSize: '12px', fontWeight: '700', letterSpacing: '1px', color: 'rgba(212,175,55,0.92)' }}>
          1:1 RESERVE BACKED · MONTHLY ATTESTED
        </div>
      </div>

      {/* 4. Strict peg */}
      <div style={{ background: CARD.peg, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(6,78,59,0.45)' }}>
        <CardHeader title="Strict 1:1 Peg to USD" iconType="shield" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Rigid USD peg. Stablecoins priced via Chainlink.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is rigidly pegged to the US dollar. USDT and USDC are <b>not</b> treated as $1.00: their live Chainlink USD prices are read on-chain by the Vault contract itself. If a stablecoin deviates more than 2% from $1, transactions revert automatically.</p>
      </div>

      {/* 5. Instant settlement */}
      <div style={{ background: CARD.instant, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(180,83,9,0.45)' }}>
        <CardHeader title="Instant Settlement" iconType="zap" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>24/7 global fund clearing.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Send money like a message. With UFO, cross-border funds arrive in the recipient's wallet within seconds, bypassing traditional banking delays.</p>
      </div>

      {/* 6. Security and compliance */}
      <div style={{ background: CARD.security, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(14,116,144,0.45)' }}>
        <CardHeader title="Security & Compliance" iconType="layers" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Cryptographically tamper-proof.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Vault reserves are transparent and verifiable on BscScan. Every transaction is secured by blockchain-level cryptography.</p>
      </div>

      {/* 7. Disclaimer */}
      <div style={{ background: CARD.disclaimer, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(190,24,93,0.45)' }}>
        <CardHeader title="Disclaimer" iconType="alert" />
        <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>A payment instrument, not an investment.</h4>
        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO does not offer yields or speculative returns. Users are solely responsible for ensuring that their use of the protocol complies with local laws. UFO is not offered to persons in restricted jurisdictions, including the <b>United States, Mainland China, Iran, North Korea, Syria, Cuba, Venezuela, Russia, and Belarus</b>.</p>
      </div>

    </div>
  );
}
