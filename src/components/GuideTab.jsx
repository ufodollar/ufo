import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📘 GuideTab — 产品说明
   定位：防盗 + 结算的稳定币，1 UFO 恒等于 1 USD
   原则：
   1. 价格说清（1:1），报价由合约给出
   2. 「隐私」只讲显示层，同时说明链上记录公开
   3. 不做监管状态、审计、储备的陈述
   4. 只描述能做的事，不写无法验证的绝对化承诺
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
          One token, two jobs: hold value out of a thief's reach, and settle
          commercial payments that carry no on-chain dollar figure.
        </h4>

        <p style={cardText}>
          Every transfer is written to BNB Chain: sender, recipient, amount,
          timestamp. What the ledger never carries is a dollar figure. UFO has
          no public price feed, so wallets and explorers print <b>$0.00</b>.
          Drainers sweep addresses, rank them by visible balance, and spend gas
          only on the ones worth draining. A wallet that reads <b>$0.00</b> is
          ranked last and skipped.
        </p>

        <Panel>
          <div>
            <b>Function 1 — anti-theft holding.</b> A balance held in UFO
            reads as zero dollars to every wallet, explorer and drainer that
            looks at it. Theft goes after what can be priced.
          </div>
          <div style={{ marginTop: '11px' }}>
            <b>Function 2 — zero-value commercial settlement.</b> Supplier
            bills, contractor payouts and cross-border invoices settle in a
            token the public chain prices at <b>$0.00</b>. Sender, recipient,
            amount and block time stay on the record; the dollar figure does
            not. The figure exists on this site only, and only at the moment
            someone asks for a quote.
          </div>
        </Panel>

        <Panel>
          <b>Settlement only.</b> The reserve vault takes stablecoins in and
          pays them out at the published rate. Nothing more.
          <div style={{ marginTop: '11px' }}>
            <b>Fixed by code, not by policy.</b> The price of 1 UFO and the
            0.5% fee are constants in the bytecode — no function exists that
            can change either. The contract is not upgradeable and runs behind
            no proxy, so the rules that shipped are the rules that execute. The
            interface is a static page: it builds a transaction, and it cannot
            move pool funds, change the rate or redirect a payout.
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
          The dollar is the unit of account. Every quote is read from the
          contract on each load; this page prints the number and cannot set it.
          What you read here is what the chain executes.
        </p>

        <div style={divider}>
          Any quote can be checked on BscScan by calling the Vault's read
          functions directly.
        </div>
      </Card>

      {/* ================= 3. 自持 · 地球 ================= */}
      <Card
        title="Self-Custody"
        icon="globe"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <h4 style={cardTitle}>Your keys, your address.</h4>

        <p style={cardText}>
          UFO sits in your own address, not in an account on this site. The
          protocol holds no key to your wallet, and moving a balance out
          always requires your signature. This page only builds a transaction
          and hands it to your wallet.
        </p>

        <Panel>
          <b>Both contract addresses are printed on every page.</b> Compare
          them against BscScan before you sign. A mismatch means you are on a
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
        <h4 style={cardTitle}>Send value like a message.</h4>

        <p style={cardText}>
          A transfer clears in one BNB Chain block. No banking hours, no
          cut-off time, and no intermediary holding the payment while it
          clears.
        </p>
      </Card>

      {/* ================= 5. 公开账本 · 分层 ================= */}
      <Card
        title="Open Ledger"
        icon="layers"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <h4 style={cardTitle}>Nothing hidden, nothing to guess.</h4>

        <p style={cardText}>
          Pool balances, total supply and every settlement are public on BNB
          Chain. There is no relay server and no backend that could be shut
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
          TokenPocket, imToken, Coin98 and ONTO are supported through their
          own in-app browsers. Tap an icon, the wallet opens, and this page
          loads inside it with the wallet already injected — no QR code and no
          relay round-trip.
        </p>

        <Panel>
          <b>On a slow connection:</b> the whole interface is under 70 KB
          gzipped, so it opens where heavier dapps time out.
        </Panel>
      </Card>

      {/* ================= 7. 法律声明 · 警告 ================= */}
      <Card
        title="Legal Notice"
        icon="alert"
        gradient="linear-gradient(145deg, #fb7185 0%, #ec4899 52%, #be185d 100%)"
        glow="rgba(236,72,153,0.50)"
      >
        <h4 style={cardTitle}>A settlement instrument, not an investment.</h4>

        <p style={cardText}>
          UFO pays no yield and returns no speculative profit. It is not a
          deposit. Redemption settles at 1 UFO = 1 USD and is paid from the
          stablecoins the pool holds. Users are solely responsible for
          ensuring their use of the protocol complies with local law.
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
