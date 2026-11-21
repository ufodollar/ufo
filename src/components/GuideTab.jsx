import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📘 GuideTab — 产品说明
   定位：防盗 + 结算，1 UFO 恒等于 1 USD
   原则：
   1. 价格说清（1:1），报价由合约给出
   2. 「隐私」只讲显示层，同时说明链上记录公开
   3. 不做监管状态、审计、储备的陈述
   4. 只描述能做的事，不写无法验证的绝对化承诺
   5. 文风：短句、实词、具体动作，不堆营销形容词
   ============================================================ */

/* 地址块：完整地址比正文长，独占一行、缩小字号、等宽字体，
   避免在窄屏上把句子撑成三四行 */
const Addr = ({ label, value }) => (
  <div style={{ marginTop: '8px' }}>
    <span style={{ opacity: 0.72, fontSize: '11.5px' }}>{label}</span>
    <div
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '10.5px',
        lineHeight: 1.5,
        wordBreak: 'break-all',
        opacity: 0.92,
      }}
    >
      {value}
    </div>
  </div>
);

export default function GuideTab() {
  return (
    <div style={tabWrap}>
      {/* ================= 1. 防盗结算 · 天平 ================= */}
      <Card
        title="Anti-Theft Settlement Stablecoin"
        icon="scale"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <h4 style={cardTitle}>
          A thief takes what he can price. Give him nothing to price.
        </h4>

        <p style={cardText}>
          Every movement is written on BNB Chain: who sent, who received, how
          much, at what hour. One thing is never written — the dollar value.
          UFO has no price feed, so wallets and explorers print <b>$0.00</b>.
          A drainer walks the street and reads the number in each window. Where
          the window says zero, he walks on.
        </p>

        <Panel>
          <div>
            <b>Function 1 — keeping.</b> A balance that shows no price is a
            balance nobody comes to take.
          </div>
          <div style={{ marginTop: '11px' }}>
            <b>Function 2 — settling trade.</b> Goods, freight, invoices,
            wages. A seller takes UFO for his work, and the public chain still
            reads <b>$0.00</b>. He sees the value at one moment only: when he
            brings it back here and takes USDT or USDC for it.
          </div>
        </Panel>

        <Panel>
          <b>Settlement only.</b> The vault takes stablecoins in and pays them
          out at the published rate. Nothing more.
          <div style={{ marginTop: '11px' }}>
            <b>Fixed by code, not by policy.</b> The price of 1 UFO and the
            0.5% fee are constants in the bytecode — no function exists that
            can change either. The contract is not upgradeable and stands
            behind no proxy, so the rules that shipped are the rules that run.
            The page is static: it builds a transaction, and it cannot move
            pool funds, change the rate or redirect a payout.
          </div>
        </Panel>
      </Card>

      {/* ================= 2. 定价 · 盾牌 ================= */}
      <Card
        title="Pricing"
        icon="shield"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <h4 style={cardTitle}>
          The unit price of 1 UFO is always equal to 1 US dollar.
        </h4>

        <p style={cardText}>
          The dollar is the ruler here, not a promise. Every quote is read from
          the contract at the moment the page loads. This page prints the
          number; it cannot set it. What you read is what the chain does.
        </p>

        <div style={divider}>
          Call the Vault's read functions on BscScan and you will get the same
          number this page shows.
        </div>
      </Card>

      {/* ================= 3. 自持 · 地球 ================= */}
      <Card
        title="Self-Custody"
        icon="globe"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <h4 style={cardTitle}>The keys are yours. So is the money.</h4>

        <p style={cardText}>
          UFO sits in your own address, not in an account on this site. Nobody
          here holds a key to your wallet. Every movement out needs your
          signature; this page only writes the transaction and hands it to you.
        </p>

        <Panel>
          <b>Both addresses are printed on every page.</b> Read them against
          BscScan before you sign. If they do not match, you are standing in a
          copy of this site.
        </Panel>
      </Card>

      {/* ================= 4. 即时结算 · 闪电 ================= */}
      <Card
        title="Instant Settlement"
        icon="zap"
        gradient="linear-gradient(145deg, #f59e0b 0%, #ea580c 60%, #c2410c 100%)"
        glow="rgba(234,88,12,0.50)"
      >
        <h4 style={cardTitle}>Send value the way you send a word.</h4>

        <p style={cardText}>
          A transfer clears in one BNB Chain block. No banking hours, no
          cut-off, no clerk holding your money while he decides.
        </p>
      </Card>

      {/* ================= 5. 公开账本 · 分层 ================= */}
      <Card
        title="Open Ledger"
        icon="layers"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <h4 style={cardTitle}>
          Everything is written down. Nothing in a drawer.
        </h4>

        <p style={cardText}>
          Pool balances, total supply and every settlement are public on BNB
          Chain. There is no server in the middle and no back room to shut
          down — the interface is a static page, and the contract is the
          product.
        </p>

        <div style={{ ...divider, opacity: 0.9 }}>
          <Addr label="Vault" value="0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2" />
          <Addr label="Token" value="0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB" />
        </div>
      </Card>

      {/* ================= 6. 钱包直达 · 连接 ================= */}
      <Card
        title="Nine Wallets, One Tap"
        icon="plug"
        gradient="linear-gradient(145deg, #06b6d4 0%, #0891b2 55%, #0e7490 100%)"
        glow="rgba(8,145,178,0.50)"
      >
        <h4 style={cardTitle}>No extension. No QR. No relay.</h4>

        <p style={cardText}>
          MetaMask, Trust Wallet, Coinbase Wallet, Bitget Wallet, Phantom,
          TokenPocket, imToken, Coin98 and ONTO all open this page inside their
          own browser. Tap an icon and the wallet opens; the page is already
          there, with the wallet in it. Nothing to scan, no relay to wait on.
        </p>

        <Panel>
          <b>On a slow line:</b> the whole interface is under 70 KB gzipped. It
          opens where heavier sites give up.
        </Panel>
      </Card>

      {/* ================= 7. 法律声明 · 警告 ================= */}
      <Card
        title="Legal Notice"
        icon="alert"
        gradient="linear-gradient(145deg, #fb7185 0%, #ec4899 52%, #be185d 100%)"
        glow="rgba(236,72,153,0.50)"
      >
        <h4 style={cardTitle}>A settlement instrument. Not an investment.</h4>

        <p style={cardText}>
          UFO pays no yield and returns no speculative profit. It is not a
          deposit. Redemption settles at 1 UFO = 1 USD and is paid from the
          stablecoins the pool holds. Whether you may use it is a question of
          your own law, and only you can answer it.
        </p>

        <p style={{ ...cardText, marginTop: '10px' }}>
          UFO is not offered to persons in restricted jurisdictions including{' '}
          <b>Afghanistan, Algeria, Bangladesh, Belarus, Bolivia, China, Cuba,
          Egypt, Iran, Iraq, Morocco, Nepal, North Korea, Qatar, Syria,
          Tunisia, and Venezuela</b>, nor to residents of any jurisdiction that
          has established a stablecoin issuance licensing regime.
        </p>
      </Card>
    </div>
  );
}
