import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📋 RulesTab — 兑换规则 / 钱包用法 / 风险提示解释
   原则：
   1. 每句给确定结论，不写「可能」「通常」「建议」
   2. 费率只在一张卡里出现，避免两处数字互相打架
   3. 样式与 GuideTab 完全一致（共用 Card / Panel / 文字样式）
   4. 文风：短句、实词、具体动作，不堆营销形容词
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
          Buying costs 0.5%. Redeeming costs 0.5%. The screen prints the fee
          and the net amount before you sign; after you sign, nothing else is
          taken.
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
          The vault pays in the coin it actually holds. If the USDT side cannot
          cover your amount, redeem into USDC. If the USDC side cannot cover
          it, redeem into USDT. The page prints the size of both sides before
          you sign, so you choose from numbers and not from a failed
          transaction.
        </p>

        <Panel>
          <b>Before you begin:</b> UFO lives on BNB Chain only. In Bitget
          Wallet, when it asks for a network, choose <b>BNB Chain</b> — it is
          written BSC there.
        </Panel>
      </Card>

      {/* ================= 2. 兑换流程 · 紫色 ================= */}
      <Card
        title="How Exchange Works"
        icon="zap"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <h4 style={cardTitle}>Three steps. One signature each.</h4>

        <Step title="Approve once">
          The first exchange of a coin needs one approval. It covers that coin
          and that amount. It gives away nothing else.
        </Step>

        <Step title="Exchange">
          Type an amount. The page reads the rate from the contract and prints
          exactly what you will get. No server does this arithmetic.
        </Step>

        <Step title="Redeem back">
          Send UFO to the vault and take stablecoins at 1 UFO = 1 USD. The
          payout comes from the coin the vault holds at that hour.
        </Step>

        <div style={divider}>
          Each step is its own transaction. Nothing moves without your
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
          On a phone the link opens the Bitget app. If the app is not there,
          the button falls back to the download page after two seconds.
        </Step>

        <Step title="If it asks for a network, choose BNB Chain">
          Bitget asks which chain to use before it loads the page. Pick{' '}
          <b>BNB Chain</b> (also written BSC). The question comes from the
          wallet, not from this site.
        </Step>

        <Step title="The page opens inside the app">
          The address bar shows this domain. The wallet is already in the page,
          so there is no code to scan and no WalletConnect step.
        </Step>

        <Step title="Tap Connect, approve once">
          Your wallet shows its own sheet. Approving joins the address to the
          page. It moves no funds and costs no gas.
        </Step>

        <Step title="Exchange or redeem">
          Type an amount and sign. Next time the connection is already there,
          and it will not ask twice.
        </Step>

        <Panel>
          <b>Stuck on the Bitget home screen?</b> Tap <b>Discover</b> at the
          bottom, then open this site again from history.
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
          MetaMask, Trust Wallet and Bitget all run scanners. A new domain and
          a new contract have no history to score, so the scanner writes{' '}
          <b>unrated</b>. That word describes the scanner's book, not this
          contract.
        </p>

        <Section>The three warnings you may see</Section>

        <Step title="“Suspicious site” / “Unverified domain”">
          The domain is not on the wallet's allowlist. A blocklist flags what
          it has never seen before. The flag is not a verdict on malware.
        </Step>

        <Step title="“Unverified contract”">
          The vault has no earlier interaction with your address. Every
          contract carries this flag on its first day.
        </Step>

        <Step title="“Token has no price”">
          Expected. UFO has no public price feed. That is why the wallet prints{' '}
          <b>$0.00</b>.
        </Step>

        <Panel>
          <b>Check us without trusting us:</b> match the vault address below
          against BscScan, then open its transaction list. The right address
          and live transactions mean the flag is only about newness.
        </Panel>
      </Card>

      {/* ================= 5. 安全清单 · 绿色 ================= */}
      <Card
        title="Safety Checklist"
        icon="shield"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <h4 style={cardTitle}>Four checks before you sign anything.</h4>

        <Step title="Enter only through this domain">
          Bookmark it. Links in direct messages, group chats and search ads are
          the usual road to a copycat site.
        </Step>

        <Step title="Match the contract address">
          Both addresses are printed on every page. Read them here, then read
          them on BscScan.
          <Addr label="Vault" value="0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2" />
          <Addr label="Token" value="0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB" />
        </Step>

        <Step title="Never give up your seed phrase">
          No support channel asks for it. Nobody can restore a wallet. Whoever
          says otherwise is lying.
        </Step>

        <Step title="Read the approval">
          The approval covers one coin and one amount. Refuse any request for
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
        <h4 style={cardTitle}>Five taps that answer most questions.</h4>

        <Panel style={{ marginTop: '10px', padding: '6px 16px' }}>
          <Row label="Transaction pending" value="Wait or speed it up" />
          <Row label="Icon does not open" value="Open the app, then retry" />
          <Row label="Connect does nothing" value="Switch to BSC" />
          <Row label="Balance reads $0.00" value="Expected — see here" />
          <Row label="Capacity reached" value="Lower the amount" last />
        </Panel>

        <div style={divider}>
          Still stuck? Write to <b>ufodollar6@gmail.com</b> with your address
          and the transaction hash. Never send money to anyone who offers to
          “fix” it for you.
        </div>
      </Card>
    </div>
  );
}
