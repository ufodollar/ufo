import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📋 RulesTab — 兑换规则 / 钱包用法 / 风险提示解释
   目的：把「不敢用」变成「知道怎么判断」
   样式与 GuideTab 完全一致（共用 Card / Panel / 文字样式）
   ============================================================ */

/* 编号步骤 */
const Step = ({ n, title, children }) => (
  <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
    <div
      style={{
        flexShrink: 0,
        width: '26px',
        height: '26px',
        borderRadius: '9px',
        background: 'rgba(255,255,255,0.28)',
        border: '1px solid rgba(255,255,255,0.38)',
        display: 'grid',
        placeItems: 'center',
        fontSize: '12.5px',
        fontWeight: 800,
      }}
    >
      {n}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '3px' }}>
        {title}
      </div>
      <div
        style={{
          fontSize: '13.5px',
          lineHeight: 1.65,
          color: 'rgba(255,255,255,0.90)',
        }}
      >
        {children}
      </div>
    </div>
  </div>
);

/* 两列信息行 */
const Row = ({ label, value, last }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: '12px',
      padding: '9px 0',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.16)',
      fontSize: '13.5px',
    }}
  >
    <span style={{ opacity: 0.88 }}>{label}</span>
    <span style={{ fontWeight: 700, textAlign: 'right' }}>{value}</span>
  </div>
);

/* 小标题（卡内分段） */
const Section = ({ children }) => (
  <div
    style={{
      marginTop: '16px',
      marginBottom: '2px',
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.72)',
    }}
  >
    {children}
  </div>
);

export default function RulesTab() {
  return (
    <div style={tabWrap}>
      {/* ================= 1. 兑换流程 · 蓝色 ================= */}
      <Card
        title="How Exchange Works"
        icon="exchange"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <h4 style={cardTitle}>Three steps, one signature each.</h4>

        <Step n="1" title="Approve once">
          The first time you exchange a token, your wallet asks for an
          approval. This lets the Vault move that specific token — it does not
          give access to anything else.
        </Step>

        <Step n="2" title="Exchange">
          Enter an amount. The page reads the current rate from the contract
          and shows exactly what you will receive before you sign. Nothing is
          calculated on a server.
        </Step>

        <Step n="3" title="Redeem whenever you want">
          Send UFO back to the Vault and receive stablecoins. The amount is
          computed at the rate in effect at that moment. There is no lock-up
          and no waiting period.
        </Step>

        <div style={divider}>
          Each step is a separate transaction, so you can always see what you
          are signing before it happens.
        </div>
      </Card>

      {/* ================= 2. 费率 · 紫色 ================= */}
      <Card
        title="Rates & Fees"
        icon="trend"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <h4 style={cardTitle}>One fee, stated up front.</h4>

        <Panel style={{ marginTop: '10px', padding: '6px 16px' }}>
          <Row label="Exchange fee" value="0.5% per exchange" />
          <Row label="Approval cost" value="Network gas only" />
          <Row label="Withdrawal fee" value="None" />
          <Row label="Hidden spread" value="None" last />
        </Panel>

        <Section>What the rate reflects</Section>
        <p style={{ ...cardText, marginTop: '6px' }}>
          The rate is read from the pool at the moment your transaction is
          mined, not when the page loaded. USDT and USDC are valued at live
          market price rather than assumed to be exactly $1.00 — so a quote
          reflects what the pool actually holds.
        </p>

        <div style={divider}>
          Fees stay in the pool. They are not transferred to a company wallet.
        </div>
      </Card>

      {/* ================= 3. Bitget Wallet 用法 · 橙色 ================= */}
      <Card
        title="Using Bitget Wallet"
        icon="wallet"
        gradient="linear-gradient(145deg, #f59e0b 0%, #ea580c 60%, #c2410c 100%)"
        glow="rgba(234,88,12,0.50)"
      >
        <h4 style={cardTitle}>Five taps from icon to connected.</h4>

        <Step n="1" title="Tap the Bitget Wallet icon">
          On mobile, this opens the Bitget app through a deep link. If the app
          is not installed, you land on its download page instead — the button
          falls back after about two seconds so it never appears frozen.
        </Step>

        <Step n="2" title="If a network prompt appears, choose BNB Chain">
          Bitget asks which chain to use before loading the page. Select{' '}
          <b>BNB Chain</b> (also shown as BSC). This prompt comes from the
          wallet, not from this site — it appears because the wallet has not
          yet recorded a preferred chain for this address.
        </Step>

        <Step n="3" title="The page opens inside the app">
          You are now in Bitget's built-in browser. The address bar shows this
          domain. The page loads with the wallet already injected, so there is
          no QR code and no WalletConnect step.
        </Step>

        <Step n="4" title="Tap Connect, approve once">
          Your wallet shows its own confirmation sheet. Approving connects the
          address only — it does not move funds and does not cost gas.
        </Step>

        <Step n="5" title="Exchange or redeem">
          Enter an amount and sign. Every later visit restores the connection
          silently, with no second prompt.
        </Step>

        <Panel>
          <b>Stuck on the Bitget home screen?</b> Tap <b>Discover</b> at the
          bottom, then reopen this site from history. Some app versions do not
          auto-advance from the home tab.
        </Panel>
      </Card>

      {/* ================= 4. 风险提示解释 · 粉色 ================= */}
      <Card
        title="Why Wallets Show Warnings"
        icon="alert"
        gradient="linear-gradient(145deg, #fb7185 0%, #ec4899 52%, #be185d 100%)"
        glow="rgba(236,72,153,0.50)"
      >
        <h4 style={cardTitle}>Unknown is not the same as unsafe.</h4>

        <p style={cardText}>
          MetaMask, Trust Wallet, Bitget and others run automated risk
          scanners. A new domain or a freshly deployed contract has no history
          for them to score, so they flag it as <b>unrated</b>. That is a
          statement about their database, not about this contract.
        </p>

        <Section>The three warnings you may see</Section>

        <Step n="1" title="“Suspicious site” / “Unverified domain”">
          Triggered by a domain that is not yet on the wallet's allowlist.
          Blocklist-based scanners default to a warning when a site is merely
          unknown. It is not a malware verdict.
        </Step>

        <Step n="2" title="“Unverified contract”">
          Triggered because the Vault has no prior interaction history with
          your address. Every new contract looks like this on day one.
        </Step>

        <Step n="3" title="“Token has no price”">
          This one is expected. UFO has no public price feed by design — that
          is exactly why your wallet shows $0.00.
        </Step>

        <Panel>
          <b>How to check for yourself, without trusting us:</b> compare the
          Vault address shown at the bottom of this page against the one on
          BscScan, and confirm it has real, ongoing transactions. If the
          addresses match and the contract is active, the warning is about
          novelty, not about risk.
        </Panel>

        <div style={divider}>
          We would rather you verify than believe. That is why the contract
          address is printed on every page.
        </div>
      </Card>

      {/* ================= 5. 安全清单 · 绿色 ================= */}
      <Card
        title="Safety Checklist"
        icon="shield"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <h4 style={cardTitle}>Four things worth doing every time.</h4>

        <Step n="1" title="Enter only through this domain">
          Bookmark it. Links in direct messages, group chats and search ads
          are the most common route to a copycat site.
        </Step>

        <Step n="2" title="Match the contract address">
          Vault <b>0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2</b>, token{' '}
          <b>0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB</b>. If either
          differs, stop.
        </Step>

        <Step n="3" title="Never share your seed phrase">
          No support channel will ever ask for it. We cannot recover a wallet,
          and anyone who claims to is lying.
        </Step>

        <Step n="4" title="Check the approval scope">
          The approval is limited to one token and one amount. If a wallet
          asks for unlimited access to everything you hold, reject it.
        </Step>
      </Card>

      {/* ================= 6. 出问题怎么办 · 靛色 ================= */}
      <Card
        title="If Something Goes Wrong"
        icon="info"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <h4 style={cardTitle}>Most issues are one of these five.</h4>

        <Panel style={{ marginTop: '10px', padding: '6px 16px' }}>
          <Row label="Transaction pending" value="Wait, or speed it up in wallet" />
          <Row label="Nothing happens on tap" value="Wallet app not installed" />
          <Row label="Connect does nothing" value="Wrong network — switch to BSC" />
          <Row label="Balance shows $0.00" value="Expected — read it here" />
          <Row label="Redeem reverts" value="Pool short on that token" last />
        </Panel>

        <Section>The last one deserves a note</Section>
        <p style={{ ...cardText, marginTop: '6px' }}>
          Redemption is paid from the token actually held in the pool. If the
          USDT side is temporarily thin, redeem in USDC instead, or reduce the
          amount. The page shows available capacity before you sign, so this
          is visible in advance rather than as a failed transaction.
        </p>

        <div style={divider}>
          Still stuck? Email <b>ufodollar6@gmail.com</b> with your address and
          the transaction hash. Never send funds to anyone offering to “fix”
          it for you.
        </div>
      </Card>
    </div>
  );
}
