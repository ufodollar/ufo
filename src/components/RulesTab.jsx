import React from 'react';

// Solid palette: no gradients, one distinct background per card.
const CARD = {
  intro: '#0ea5e9',      // sky blue
  camouflage: '#7c3aed', // violet
  trusted: '#0c4a6e',    // deep ocean blue
  peg: '#047857',        // deep emerald
  instant: '#c2410c',    // burnt terracotta
  security: '#0e7490',   // slate cyan
  disclaimer: '#0f1013'  // deep black
};

const GOLD = '#FDE68A';

const CardTitle = ({ children, accent }) => (
  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: accent || 'rgba(255,255,255,0.8)', marginBottom: '12px' }}>
    {children}
  </div>
);

export default function RulesTab() {
  return (
    <div style={{ background: '#f4f7f9', minHeight: '100vh', padding: '20px', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: CARD.intro }} />
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#64748b' }}>
              Rules &amp; Protocol
            </span>
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', lineHeight: 1.25 }}>
            Stealth Value Settlement
          </h2>
          <p style={{ color: '#475569', margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
            Designed for hiding stablecoin assets and stealth global trade settlement.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 1. Core introduction — sky blue */}
          <article style={{ background: CARD.intro, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(14,165,233,0.7)' }}>
            <CardTitle>Core Positioning</CardTitle>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.35 }}>
              Designed for absolute asset protection.
            </h3>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.95)', margin: 0 }}>
              UFO is a USD-pegged stablecoin. By avoiding public exchange listings, standard wallets display its fiat value as <b>$0.00</b>. This provides powerful physical camouflage against ransomware and automated wallet drainers.
            </p>
            <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.15)', padding: '16px', borderRadius: '16px' }}>
              <strong style={{ display: 'block', marginBottom: '6px', fontSize: '14px' }}>How it works:</strong>
              <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.95)', margin: 0 }}>
                Mint UFO using USDT or USDC and send it to your business partners. They can seamlessly redeem it for stablecoins, bypassing the friction and exposure of traditional transfers.
              </p>
            </div>
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
              Currently widely used in over 60 countries worldwide for invisible global trade settlement.
            </div>
          </article>

          {/* 2. Asset camouflage — violet */}
          <article style={{ background: CARD.camouflage, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(124,58,237,0.7)' }}>
            <CardTitle>Asset Camouflage</CardTitle>
            <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>Unobtrusive transfers and settlement.</h4>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              The protocol runs on a closed loop with no public DEX liquidity. In mainstream wallets, UFO displays as $0.00, so bystanders and automated trackers only see a transfer of an asset with no visible value.
            </p>
          </article>

          {/* 3. Trusted UFO — deep ocean blue */}
          <article style={{ background: CARD.trusted, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(12,74,110,0.75)' }}>
            <CardTitle accent={GOLD}>Trusted UFO</CardTitle>
            <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>Issued and attested under U.S. regulatory standards.</h4>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              UFO is a regulated digital asset issued in 2023 by Stone X, a regulated financial services firm adhering to U.S. laws and standards to safeguard your funds. Each UFO is fully backed 1:1 by USD or cash equivalents held in public reserves, with monthly attestations from one of the Big Four accounting firms. Trust verifiable facts, not empty promises.
            </p>
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(253,230,138,0.4)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: GOLD }}>
              1:1 RESERVE BACKED · MONTHLY ATTESTED
            </div>
          </article>

          {/* 4. Strict peg — deep emerald */}
          <article style={{ background: CARD.peg, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(4,120,87,0.7)' }}>
            <CardTitle>Strict 1:1 Peg to USD</CardTitle>
            <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>Rigid USD peg, priced via Chainlink.</h4>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              USDT and USDC are <b>not</b> treated as $1.00: their live Chainlink USD prices are read on-chain by the Vault contract itself. If a stablecoin deviates more than 2% from $1, transactions revert automatically.
            </p>
          </article>

          {/* 5. Instant settlement — terracotta */}
          <article style={{ background: CARD.instant, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(194,65,12,0.7)' }}>
            <CardTitle>Instant Settlement</CardTitle>
            <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>24/7 global fund clearing.</h4>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              Send money like a message. Cross-border funds arrive in the recipient's wallet within seconds, bypassing traditional banking delays.
            </p>
          </article>

          {/* 6. Security and compliance — slate cyan */}
          <article style={{ background: CARD.security, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(14,116,144,0.7)' }}>
            <CardTitle>Security &amp; Compliance</CardTitle>
            <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>Cryptographically tamper-proof.</h4>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
              Vault reserves are transparent and verifiable on BscScan. Every transaction is secured by blockchain-level cryptography.
            </p>
          </article>

          {/* 7. Disclaimer — deep black */}
          <article style={{ background: CARD.disclaimer, padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 12px 28px -14px rgba(0,0,0,0.65)' }}>
            <CardTitle>Disclaimer</CardTitle>
            <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 10px' }}>A payment instrument, not an investment.</h4>
            <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'rgba(255,255,255,0.88)', margin: 0 }}>
              UFO does not offer yields or speculative returns. Users are solely responsible for ensuring their use of the protocol complies with local laws. Not offered to persons in restricted jurisdictions, including the <b>United States, Mainland China, Iran, North Korea, Syria, Cuba, Venezuela, Russia, and Belarus</b>.
            </p>
          </article>

        </div>
      </div>
    </div>
  );
}
