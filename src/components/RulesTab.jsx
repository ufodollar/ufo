import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📋 RulesTab — 兑换规则 / 钱包用法 / 风险提示解释
   原则：
   1. 每句给确定结论，不写「可能」「通常」「建议」
   2. 费率只在一张卡里出现，避免两处数字互相打架
   3. 样式与 GuideTab 完全一致（共用 Card / Panel / 文字样式）
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

/* 合约地址：完整长度独占一行，缩小字号，避免把句子撑成四行 */
const Addr = ({ label, value }) => (
  <div style={{ marginTop: '6px' }}>
    <span style={{ fontSize: '11.5px', opacity: 0.72 }}>{label} </span>
    <span
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '10.5px',
        lineHeight: 1.55,
        wordBreak: 'break-all',
        opacity: 0.92,
      }}
    >
      {value}
    </span>
  </div>
);

export default function RulesTab() {
  return (
    <div style={tabWrap}>
      {/* ================= 1. 购买与赎回（含费率）· 蓝色 ================= */}
      <Card
        title="Buying & Redeeming"
        icon="exchange"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <h4 style={cardTitle}>
          The unit price of 1 UFO is always equal to 1 US dollar.
        </h4>

        <p style={cardText}>
          Purchase charges 0.5%. Redemption charges 0.5%. The confirmation
          screen prints the fee and the net amount before you sign, and no
          second deduction follows the signature.
        </p>

        <Panel style={{ marginTop: '10px', padding: '6px 16px' }}>
          <Row label="Purchase fee" value="0.5%" />
          <Row label="Redemption fee" value="0.5%" />
          <Row label="Hidden spread" value="None" />
          <Row label="Network gas" value="Paid to BNB Chain" />
          <Row label="Settlement chain" value="BNB Chain only" last />
        </Panel>

        <Section>How redemption is paid</Section>
        <p style={{ ...cardText, marginTop: '6px' }}>
          The vault pays out in the stablecoin it actually holds. If the USDT
          side does not cover your amount, redeem in USDC instead. If the USDC
          side does not cover it, redeem in USDT. The swap page prints the
          capacity of both sides before you sign, so the payout side is picked
          from numbers instead of from a failed transaction.
        </p>

        <Panel>
          <b>Before you start:</b> UFO runs on BNB Chain only. In Bitget
          Wallet, pick <b>BNB Chain</b> (shown as BSC) at the network prompt.
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
          The first exchange of a token needs one approval. It covers that
          token and that amount. It grants nothing else.
        </Step>

        <Step title="Exchange">
          Enter an amount. The page reads the rate from the contract and
          prints the exact amount you receive. No server computes it.
        </Step>

        <Step title="Redeem back">
          Send UFO to the vault and take stablecoins at 1 UFO = 1 USD. The
          payout comes from the token the vault holds.
        </Step>

        <div style={divider}>
          Each step is a separate transaction. Nothing moves without your
          signature.
        </div>
      </Card>

      {/* ================= 3. Bitget Wallet 用法 · 靛色 ================= */}
      <Card
        title="Using Bitget Wallet"
        icon="wallet"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <h4 style={cardTitle}>Five taps from icon to connected.</h4>

        <Step title="Tap the Bitget Wallet icon">
          On mobile the deep link opens the Bitget app. If the app is not
          installed, the button falls back to the download page after two
          seconds.
        </Step>

        <Step title="If a network prompt appears, choose BNB Chain">
          Bitget asks which chain to use before it loads the page. Select{' '}
          <b>BNB Chain</b> (also shown as BSC). The prompt comes from the
          wallet, not from this site.
        </Step>

        <Step title="The page opens inside the app">
          The address bar shows this domain. The wallet is already injected,
          so there is no QR code and no WalletConnect step.
        </Step>

        <Step title="Tap Connect, approve once">
          Your wallet shows its own confirmation sheet. Approving connects the
          address. It moves no funds and costs no gas.
        </Step>

        <Step title="Exchange or redeem">
          Enter an amount and sign. Later visits restore the connection
          without a second prompt.
        </Step>

        <Panel>
          <b>Stuck on the Bitget home screen?</b> Tap <b>Discover</b> at the
          bottom, then reopen this site from history.
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
          MetaMask, Trust Wallet and Bitget run automated risk scanners. A new
          domain and a newly deployed contract carry no history to score, so
          the scanner marks them <b>unrated</b>. That verdict describes the
          scanner's database. It describes nothing about this contract.
        </p>

        <Section>The three warnings you may see</Section>

        <Step title="“Suspicious site” / “Unverified domain”">
          The domain is not on the wallet's allowlist. Blocklist scanners flag
          anything they have not seen before. The flag is not a malware
          verdict.
        </Step>

        <Step title="“Unverified contract”">
          The vault has no prior interaction with your address. Every contract
          carries this flag on its first day.
        </Step>

        <Step title="“Token has no price”">
          Expected. UFO has no public price feed. That is why the wallet
          prints <b>$0.00</b>.
        </Step>

        <Panel>
          <b>Check without trusting us:</b> match the vault address below
          against BscScan, then open the contract's transaction list. Matching
          addresses plus live transactions mean the flag is about novelty.
        </Panel>
      </Card>

      {/* ================= 5. 安全清单 · 绿色 ================= */}
      <Card
        title="Safety Checklist"
        icon="shield"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <h4 style={cardTitle}>Four checks before every signature.</h4>

        <Step title="Enter only through this domain">
          Bookmark it. Links in direct messages, group chats and search ads
          are the standard route to a copycat site.
        </Step>

        <Step title="Match the contract address">
          Both addresses are printed on every page. Read them here, then read
          them on BscScan.
          <Addr label="Vault" value="0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2" />
          <Addr label="Token" value="0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB" />
        </Step>

        <Step title="Never share your seed phrase">
          No support channel asks for it. No one can recover a wallet. Anyone
          who says otherwise is lying.
        </Step>

        <Step title="Check the approval scope">
          The approval covers one token and one amount. Reject any request for
          unlimited access.
        </Step>
      </Card>

      {/* ================= 6. 常见操作 · 青色 ================= */}
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
