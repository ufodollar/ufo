import React from 'react';

const RuleIcon = ({ type, size = 22 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };
  const icons = {
    globe: <svg {...common}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
    safe: <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="12" cy="12" r="3" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg>,
    shield: <svg {...common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    eye: <svg {...common}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
    layers: <svg {...common}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>,
    zap: <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
    lock: <svg {...common}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
    alert: <svg {...common}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    scale: <svg {...common}><path d="M12 3v18" /><path d="M5 21h14" /><path d="M3 7h18" /><path d="M7 7l-4 8a4 4 0 0 0 8 0L7 7z" /><path d="M17 7l-4 8a4 4 0 0 0 8 0l-4-8z" /></svg>
  };
  return icons[type] || null;
};

const Section = ({ no, label, accent, icon, children }) => (
  <section style={{ padding: 'clamp(30px, 5vw, 42px) 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
      <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.16em', color: accent, fontVariantNumeric: 'tabular-nums' }}>{no}</span>
      <span style={{ flex: '0 0 40px', height: '2px', background: accent, opacity: 0.9, borderRadius: '2px' }} />
      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(232,237,245,0.5)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', color: accent, opacity: 0.9, lineHeight: 0 }}><RuleIcon type={icon} /></span>
    </div>
    {children}
  </section>
);

const H = ({ children }) => (
  <h2 style={{ fontSize: 'clamp(19px, 3.2vw, 23px)', fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.01em', margin: '0 0 14px', color: '#fff' }}>{children}</h2>
);

const P = ({ children, style }) => (
  <p style={{ fontSize: 'clamp(14.5px, 2vw, 15.5px)', lineHeight: 1.78, color: 'rgba(232,237,245,0.72)', margin: 0, ...style }}>{children}</p>
);

export default function RulesTab() {
  const GOLD = '#D4AF37';
  const ACCENT = {
    intro: '#3b82f6',
    camouflage: '#94a3b8',
    trusted: GOLD,
    peg: '#10b981',
    instant: '#f59e0b',
    security: '#22d3ee',
    disclaimer: '#f472b6'
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#070b12', color: '#e8edf5', overflow: 'hidden', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>

      {/* ---------- Decorative background ---------- */}
      <div aria-hidden="true" style={{ position: 'absolute', top: '-200px', left: '-160px', width: '540px', height: '540px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.38), rgba(59,130,246,0) 68%)', filter: 'blur(28px)', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: '-120px', right: '-180px', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,175,55,0.22), rgba(212,175,55,0) 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: '-220px', left: '12%', width: '600px', height: '520px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,116,144,0.28), rgba(14,116,144,0) 72%)', filter: 'blur(36px)', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: '28%', right: '-120px', width: '340px', height: '340px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(190,24,93,0.18), rgba(190,24,93,0) 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />

      {/* Hairline grid, faded toward the bottom */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)', backgroundSize: '56px 56px', WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, #000 0%, rgba(0,0,0,0.35) 55%, transparent 82%)', maskImage: 'radial-gradient(ellipse at 50% 0%, #000 0%, rgba(0,0,0,0.35) 55%, transparent 82%)' }} />

      {/* Top gold hairline */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'rgba(212,175,55,0.5)', pointerEvents: 'none' }} />

      {/* ---------- Content ---------- */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: '880px', margin: '0 auto', padding: 'clamp(48px, 9vw, 96px) clamp(20px, 5vw, 32px) clamp(64px, 10vw, 112px)' }}>

        {/* Hero */}
        <header style={{ marginBottom: 'clamp(8px, 2vw, 18px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: GOLD, boxShadow: '0 0 10px rgba(212,175,55,0.8)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(232,237,245,0.55)' }}>Rules &amp; Protocol</span>
          </div>

          <h1 style={{ fontSize: 'clamp(30px, 6.4vw, 46px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.025em', margin: '0 0 20px', color: '#fff' }}>
            Value-invisible<br />trade settlement.
          </h1>

          <p style={{ fontSize: 'clamp(15px, 2.4vw, 17.5px)', lineHeight: 1.7, color: 'rgba(232,237,245,0.74)', maxWidth: '640px', margin: 0 }}>
            Specifically designed for concealing stablecoin assets and invisible global trade settlement.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(20px, 5vw, 48px)', marginTop: 'clamp(30px, 5vw, 40px)', paddingTop: '26px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {[
              ['60+', 'Countries'],
              ['1:1', 'Reserve backed'],
              ['24/7', 'Settlement']
            ].map(([value, label]) => (
              <div key={label}>
                <div style={{ fontSize: 'clamp(20px, 3vw, 24px)', fontWeight: 800, letterSpacing: '-0.01em', color: '#fff', lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(232,237,245,0.45)', marginTop: '6px' }}>{label}</div>
              </div>
            ))}
          </div>
        </header>

        {/* 01 Introduction */}
        <Section no="01" label="Introduction" accent={ACCENT.intro} icon="eye">
          <H>Protection by design, not by promise.</H>
          <P>
            UFO is a USD-pegged stablecoin engineered for absolute asset protection. By avoiding public exchange listings, standard wallets display its fiat value as <b style={{ color: '#fff' }}>$0.00</b>. This acts as a powerful physical camouflage against extortion and automated wallet-draining bots.
          </P>
          <div style={{ marginTop: '24px', paddingLeft: '18px', borderLeft: `2px solid ${ACCENT.intro}` }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(232,237,245,0.5)', marginBottom: '8px' }}>How it works</div>
            <P>Mint UFO with USDT or USDC and send it to your commercial partners. They can seamlessly redeem it for stablecoins, bypassing the friction and exposure of traditional transfers.</P>
          </div>
          <P style={{ marginTop: '22px', fontSize: '13px', letterSpacing: '0.02em', color: 'rgba(232,237,245,0.55)' }}>
            Currently widely used in over 60 countries worldwide for invisible global trade settlement.
          </P>
        </Section>

        {/* 02 Asset camouflage */}
        <Section no="02" label="Asset Camouflage" accent={ACCENT.camouflage} icon="lock">
          <H>Unobtrusive transfers and settlement.</H>
          <P>
            The protocol operates as a closed-loop network with no public DEX liquidity pools. When you send or receive UFO in mainstream wallets, bystanders and automated trackers only see a transfer of an asset valued at $0.00.
          </P>
        </Section>

        {/* 03 Trusted UFO */}
        <Section no="03" label="Trusted UFO" accent={ACCENT.trusted} icon="scale">
          <H>Issued and attested under U.S. regulatory standards.</H>
          <P>
            UFO is a regulated digital asset issued in 2023 by Stone X, a regulated financial services firm that adheres to U.S. laws and standards to safeguard your funds. Each UFO is fully backed 1:1 by USD or cash equivalents held in Stone X's public reserves, with monthly attestations provided by one of the Big Four accounting firms. We provide this level of transparency to demonstrate our commitment to accountability. Trust verifiable facts, not empty promises.
          </P>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '22px' }}>
            <span style={{ flex: '0 0 28px', height: '1px', background: 'rgba(212,175,55,0.7)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(212,175,55,0.92)' }}>1:1 RESERVE BACKED · MONTHLY ATTESTED</span>
          </div>
        </Section>

        {/* 04 Strict peg */}
        <Section no="04" label="Strict 1:1 Peg to USD" accent={ACCENT.peg} icon="shield">
          <H>Rigid USD peg. Stablecoins priced via Chainlink.</H>
          <P>
            UFO is rigidly pegged to the US dollar. USDT and USDC are <b style={{ color: '#fff' }}>not</b> treated as $1.00: their live Chainlink USD prices are read on-chain by the Vault contract itself. If a stablecoin deviates more than 2% from $1, transactions revert automatically.
          </P>
        </Section>

        {/* 05 Instant settlement */}
        <Section no="05" label="Instant Settlement" accent={ACCENT.instant} icon="zap">
          <H>24/7 global fund clearing.</H>
          <P>
            Send money like a message. With UFO, cross-border funds arrive in the recipient's wallet within seconds, bypassing traditional banking delays.
          </P>
        </Section>

        {/* 06 Security and compliance */}
        <Section no="06" label="Security &amp; Compliance" accent={ACCENT.security} icon="layers">
          <H>Cryptographically tamper-proof.</H>
          <P>
            Vault reserves are transparent and verifiable on BscScan. Every transaction is secured by blockchain-level cryptography.
          </P>
        </Section>

        {/* 07 Disclaimer */}
        <Section no="07" label="Disclaimer" accent={ACCENT.disclaimer} icon="alert">
          <H>A payment instrument, not an investment.</H>
          <P>
            UFO does not offer yields or speculative returns. Users are solely responsible for ensuring that their use of the protocol complies with local laws. UFO is not offered to persons in restricted jurisdictions, including the <b style={{ color: '#fff' }}>United States, Mainland China, Iran, North Korea, Syria, Cuba, Venezuela, Russia, and Belarus</b>.
          </P>
        </Section>

        {/* Footer mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(212,175,55,0.8)' }} />
          <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(232,237,245,0.4)' }}>UFO · Payment Infrastructure</span>
        </div>

      </div>
    </div>
  );
}
