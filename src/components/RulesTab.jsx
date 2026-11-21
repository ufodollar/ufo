import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📋 RulesTab — 兑换规则 / 钱包用法 / 风险提示解释
   目的：把「不敢用」变成「知道怎么判断」
   样式与 GuideTab 完全一致（共用 Card / Panel / 文字样式）
   编号已移除，改用左侧竖线分段
   ============================================================ */

/* 无编号步骤：左侧细线 + 加粗标题 */
const Step = ({ title, children }) => (
  <div
    style={{
      marginTop: '14px',
      paddingLeft: '12px',
      borderLeft: '2px solid rgba(255,255,255,0.30)',
    }}
  >
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
      {/* ================= 1. 购买与赎回 · 蓝色 ================= */}
      <Card
        title="Buying & Redeeming"
        icon="exchange"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <h4 style={cardTitle}>
          The unit price of 1 UFO is always equal to 1 US dollar.
        </h4>

        <Panel style={{ marginTop: '10px', padding: '6px 16px' }}>
          <Row label="Purchase" value="0.5% fee" />
          <Row label="Redemption" value="0.5% fee" />
          <Row label="Network" value="BNB Chain only" last />
        </Panel>

        <Section>How redemption is paid</Section>
        <p style={{ ...cardText, marginTop: '6px' }}>
          Redemption is paid from the stablecoins actually held in the pool,
          and you can take the payout in either USDT or USDC. Available
          capacity for each side is shown on the page before you sign, so the
          amount is confirmed up front.
        </p>

        <Panel>
          <b>Before you start:</b> UFO runs on BNB Chain only. In Bitget
          Wallet, pick <b>BNB Chain</b> (shown as BSC) when the network prompt
          appears.
        </Panel>
      </Card>

      {/* ================= 2. 兑换流程 · 紫色 ================= */}
      <Card
        title="How Exchange Works"
        icon="zap"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <h4 style={cardTitle}>Three steps, one signature each.</h4>

        <Step title="Approve once">
          The first time you exchange a token, your wallet asks for an
          approval. It covers that one token and that one amount — nothing
          else you hold.
        </Step>

        <Step title="Exchange">
          Enter an amount. The page reads the rate from the contract and shows
          exactly what you receive before you sign. Nothing is calculated on a
          server.
        </Step>

        <Step title="Redeem back">
          Send UFO to the Vault and receive stablecoins at 1 UFO = 1 USD.
          Payout comes from the token the pool actually holds, so capacity is
          shown before you sign.
        </Step>

        <div style={divider}>
          Each step is a separate transaction. Nothing moves without your
          signature.
        </div>
      </Card>

      {/* ================= 3. 费用 · 橙色 ================= */}
      <Card
        title="Rates & Fees"
        icon="trend"
        gradient="linear-gradient(145deg, #f59e0b 0%, #ea580c 60%, #c2410c 100%)"
        glow="rgba(234,88,12,0.50)"
      >
        <h4 style={cardTitle}>One fee, stated up front.</h4>

        <Panel style={{ marginTop: '10px', padding: '6px 16px' }}>
          <Row label="Purchase fee" value="0.5%" />
          <Row label="Redemption fee" value="0.5%" />
          <Row label="Network gas" value="Paid to BNB Chain" />
          <Row label="Hidden spread" value="None" last />
        </Panel>

        <Section>When it is charged</Section>
        <p style={{ ...cardText, marginTop: '6px' }}>
          Once per transaction, shown in your wallet before you sign. The
          amount on the confirmation screen is the amount that leaves your
          address.
        </p>

        <div style={divider}>
          No withdrawal charge, and no deduction applied after you sign.
        </div>
      </Card>

      {/* ================= 4. Bitget Wallet 用法 · 靛色 ================= */}
      <Card
        title="Using Bitget Wallet"
        icon="wallet"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <h4 style={cardTitle}>Five taps from icon to connected.</h4>

        <Step title="Tap the Bitget Wallet icon">
          On mobile, this opens the Bitget app through a deep link. If the app
          is not installed, you land on its download page instead — the button
          falls back after about two seconds so it never appears frozen.
        </Step>

        <Step title="If a network prompt appears, choose BNB Chain">
          Bitget asks which chain to use before loading the page. Select{' '}
          <b>BNB Chain</b> (also shown as BSC). This prompt comes from the
          wallet, not from this site — it appears because the wallet has not
          yet recorded a preferred chain for this address.
        </Step>

        <Step title="The page opens inside the app">
          You are now in Bitget's built-in browser. The address bar shows this
          domain. The page loads with the wallet already injected, so there is
          no QR code and no WalletConnect step.
        </Step>

        <Step title="Tap Connect, approve once">
          Your wallet shows its own confirmation sheet. Approving connects the
          address only — it does not move funds and does not cost gas.
        </Step>

        <Step title="Exchange or redeem">
          Enter an amount and sign. Every later visit restores the connection
          silently, with no second prompt.
        </Step>

        <Panel>
          <b>Stuck on the Bitget home screen?</b> Tap <b>Discover</b> at the
          bottom, then reopen this site from history. Some app versions do not
          auto-advance from the home tab.
        </Panel>
      </Card>

      {/* ================= 5. 风险提示解释 · 粉色 ================= */}
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

        <Step title="“Suspicious site” / “Unverified domain”">
          Triggered by a domain that is not yet on the wallet's allowlist.
          Blocklist-based scanners default to a warning when a site is merely
          unknown. It is not a malware verdict.
        </Step>

        <Step title="“Unverified contract”">
          Triggered because the Vault has no prior interaction history with
          your address. Every new contract looks like this on day one.
        </Step>

        <Step title="“Token has no price”">
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

      {/* ================= 6. 安全清单 · 绿色 ================= */}
      <Card
        title="Safety Checklist"
        icon="shield"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <h4 style={cardTitle}>Four things worth doing every time.</h4>

        <Step title="Enter only through this domain">
          Bookmark it. Links in direct messages, group chats and search ads
          are the most common route to a copycat site.
        </Step>

        <Step title="Match the contract address">
          <span style={{ display: 'block', marginBottom: '6px' }}>
            Both addresses are printed here and on every other page. Match them
            before you sign.
          </span>
          <span
            style={{
              display: 'block',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '10.5px',
              lineHeight: 1.55,
              wordBreak: 'break-all',
              opacity: 0.92,
            }}
          >
            Vault 0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2
            <br />
            Token 0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB
          </span>
        </Step>

        <Step title="Never share your seed phrase">
          No support channel will ever ask for it. We cannot recover a wallet,
          and anyone who claims to is lying.
        </Step>

        <Step title="Check the approval scope">
          The approval is limited to one token and one amount. If a wallet
          asks for unlimited access to everything you hold, reject it.
        </Step>
      </Card>

      {/* ================= 7. 常见操作 · 青色 ================= */}
      <Card
        title="Quick Fixes"
        icon="info"
        gradient="linear-gradient(145deg, #06b6d4 0%, #0891b2 55%, #0e7490 100%)"
        glow="rgba(8,145,178,0.50)"
      >
        <h4 style={cardTitle}>Five taps that cover most questions.</h4>

        <Panel style={{ marginTop: '10px', padding: '6px 16px' }}>
          <Row label="Transaction pending" value="Wait or speed up" />
          <Row label="Icon does not open" value="Open the app, retry" />
          <Row label="Connect does nothing" value="Switch to BSC" />
          <Row label="Balance reads $0.00" value="Expected — see here" />
          <Row label="Capacity reached" value="Lower the amount" last />
        </Panel>

        <div style={divider}>
          Still stuck? Email <b>ufodollar6@gmail.com</b> with your address and
          the transaction hash. Never send funds to anyone offering to “fix”
          it for you.
        </div>
      </Card>
    </div>
  );
}
