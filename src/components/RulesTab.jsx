import React from 'react';

const icons = {
  globe: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  safe: 'M3 3h18v18H3z M12 1v2 M12 21v2 M1 12h2 M21 12h2',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  layers: 'M12 2 2 7l10 5 10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9z',
  lock: 'M3 11h18v11H3z M7 11V7a5 5 0 0 1 10 0v4',
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  scale: 'M12 3v18 M5 21h14 M3 7h18 M7 7l-4 8a4 4 0 0 0 8 0z M17 7l-4 8a4 4 0 0 0 8 0z'
};

const Icon = ({ type, size = 26, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icons[type].split(' M').map((d, i) => (
      <path key={i} d={i === 0 ? d : 'M' + d} />
    ))}
  </svg>
);

const PALETTE = {
  intro: '#0ea5e9',
  camouflage: '#7c3aed',
  trusted: '#a16207',
  peg: '#047857',
  instant: '#c2410c',
  security: '#0e7490',
  disclaimer: '#db2777'
};

const SectionHeader = ({ no, label, accent, icon }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
    <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.16em', color: accent, fontVariantNumeric: 'tabular-nums' }}>{no}</span>
    <span style={{ flex: '0 0 36px', height: '2px', borderRadius: '2px', background: accent }} />
    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748b' }}>{label}</span>
    <span style={{ marginLeft: 'auto', color: accent, opacity: 0.9, lineHeight: 0 }}><Icon type={icon} /></span>
  </div>
);

const Title = ({ children }) => (
  <h3 style={{ fontSize: 'clamp(17px, 2.6vw, 19px)', fontWeight: 800, lineHeight: 1.35, letterSpacing: '-0.01em', margin: '0 0 8px', color: '#0f172a' }}>{children}</h3>
);

const Body = ({ children }) => (
  <p style={{ fontSize: 'clamp(14px, 2vw, 14.5px)', lineHeight: 1.75, color: '#475569', margin: 0 }}>{children}</p>
);

export default function RulesTab() {
  const GOLD = '#FDE68A';

  return (
    <div style={{ background: '#eef1f6', padding: 'clamp(24px, 5vw, 36px) 0', fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 clamp(16px, 4vw, 20px)' }}>

        {/* Page header */}
        <div style={{ marginBottom: 'clamp(18px, 3vw, 24px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: PALETTE.intro }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#64748b' }}>Rules &amp; Protocol</span>
          </div>
          <h1 style={{ fontSize: 'clamp(22px, 4vw, 26px)', fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em', margin: '0 0 8px', color: '#0f172a' }}>
            Value-invisible trade settlement
          </h1>
          <p style={{ fontSize: '14px', lineHeight: 1.6, margin: 0, color: '#475569' }}>
            Specifically designed for concealing stablecoin assets and invisible global trade settlement.
          </p>
        </div>

        {/* 1. Core introduction - solid sky-blue card */}
        <article style={{ background: PALETTE.intro, padding: 'clamp(20px, 4vw, 26px)', borderRadius: '24px', color: '#fff', boxShadow: '0 16px 32px -16px rgba(14,165,233,0.75)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.82)' }}>Value-Invisible Trade Settlement</div>
            <div style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 0 }}><Icon type="eye" /></div>
          </div>
          <h2 style={{ fontSize: 'clamp(19px, 3.2vw, 22px)', fontWeight: 800, lineHeight: 1.3, margin: '0 0 14px', color: '#fff' }}>
            Specifically designed for concealing stablecoin assets and invisible global trade settlement.
          </h2>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'rgba(255,255,255,0.94)', margin: 0 }}>
            UFO is a USD-pegged stablecoin engineered for absolute asset protection. By avoiding public exchange listings, standard wallets display its fiat value as <b>$0.00</b>. This acts as a powerful physical camouflage against extortion and automated wallet-draining bots.
          </p>
          <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.18)', padding: '14px', borderRadius: '14px', fontSize: '14px', lineHeight: 1.7, color: '#fff' }}>
            <b>How it works:</b> Mint UFO with USDT or USDC and send it to your commercial partners. They can seamlessly redeem it for stablecoins, bypassing the friction and exposure of traditional transfers.
          </div>
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
            Currently widely used in over 60 countries worldwide for invisible global trade settlement.
          </div>
        </article>

        {/* Sections 02-07: card-free, timeline style */}
        <div style={{ marginTop: 'clamp(28px, 5vw, 40px)' }}>
          {[
            { no: '02', label: 'Asset Camouflage', accent: PALETTE.camouflage, icon: 'lock', title: 'Unobtrusive transfers and settlement.', body: 'The protocol operates as a closed-loop network with no public DEX liquidity pools. When you send or receive UFO in mainstream wallets, bystanders and automated trackers only see a transfer of an asset valued at $0.00.' },
            { no: '03', label: 'Trusted UFO', accent: PALETTE.trusted, icon: 'scale', title: 'Issued and attested under U.S. regulatory standards.', body: 'UFO is a regulated digital asset issued in 2023 by Stone X, a regulated financial services firm that adheres to U.S. laws and standards to safeguard your funds. Each UFO is fully backed 1:1 by USD or cash equivalents held in Stone X\'s public reserves, with monthly attestations provided by one of the Big Four accounting firms.', note: '1:1 RESERVE BACKED · MONTHLY ATTESTED', noteColor: GOLD },
            { no: '04', label: 'Strict 1:1 Peg to USD', accent: PALETTE.peg, icon: 'shield', title: 'Rigid USD peg. Stablecoins priced via Chainlink.', body: 'UFO is rigidly pegged to the US dollar. USDT and USDC are not treated as $1.00: their live Chainlink USD prices are read on-chain by the Vault contract itself. If a stablecoin deviates more than 2% from $1, transactions revert automatically.' },
            { no: '05', label: 'Instant Settlement', accent: PALETTE.instant, icon: 'zap', title: '24/7 global fund clearing.', body: 'Send money like a message. With UFO, cross-border funds arrive in the recipient\'s wallet within seconds, bypassing traditional banking delays.' },
            { no: '06', label: 'Security & Compliance', accent: PALETTE.security, icon: 'layers', title: 'Cryptographically tamper-proof.', body: 'Vault reserves are transparent and verifiable on BscScan. Every transaction is secured by blockchain-level cryptography.' },
            { no: '07', label: 'Disclaimer', accent: PALETTE.disclaimer, icon: 'alert', title: 'A payment instrument, not an investment.', body: 'UFO does not offer yields or speculative returns. Users are solely responsible for ensuring that their use of the protocol complies with local laws. UFO is not offered to persons in restricted jurisdictions, including the United States, Mainland China, Iran, North Korea, Syria, Cuba, Venezuela, Russia, and Belarus.' }
          ].map((s, i) => (
            <section key={s.no} style={{ padding: 'clamp(20px, 4vw, 26px) 0', borderTop: '1px solid rgba(15,23,42,0.09)' }}>
              <SectionHeader no={s.no} label={s.label} accent={s.accent} icon={s.icon} />
              <Title>{s.title}</Title>
              <Body>{s.body}</Body>
              {s.note && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                  <span style={{ flex: '0 0 24px', height: '1px', background: 'rgba(253,230,138,0.8)' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.16em', color: s.noteColor }}>{s.note}</span>
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '26px', marginTop: '8px', borderTop: '1px solid rgba(15,23,42,0.09)' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: PALETTE.intro }} />
          <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#64748b' }}>UFO · Payment Infrastructure</span>
        </div>

      </div>
    </div>
  );
}
