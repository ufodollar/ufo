import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📘 GuideTab — 产品说明（原 Rules 页改写）
   原则：
   1. 不出现 peg / pegged / stable / stablecoin / 1:1 / backed / reserve
   2. 不做任何监管状态、审计、储备的陈述（除非可验证）
   3. 「隐私」只讲显示层，同时主动说明链上公开
   ============================================================ */
export default function GuideTab() {
  return (
    <div style={tabWrap}>
      {/* ================= 1. 余额隐私 · 地球 ================= */}
      <Card
        title="Balance Privacy"
        icon="globe"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <h3 style={{ ...cardTitle, fontSize: '21px' }}>
          A wallet that reads zero.
        </h3>

        <p style={cardText}>
          UFO is a settlement asset with no public price feed. Mainstream
          wallets therefore display its fiat value as <b>$0.00</b>. This is a
          display-layer design, not a malfunction — your balance is stored
          on-chain, in your own address, and the real number is always one
          click away on this page.
        </p>

        <Panel>
          <b>How it works:</b> exchange USDT or USDC for UFO, send it to any
          address, and redeem it back whenever you want.
        </Panel>

        <div style={divider}>
          Every transfer is publicly recorded on BNB Chain. Privacy here means
          what your screen shows — not what the ledger hides.
        </div>
      </Card>

      {/* ================= 2. 旁人看到什么 · 锁 ================= */}
      <Card
        title="What Others See"
        icon="lock"
        gradient="linear-gradient(145deg, #475569 0%, #334155 55%, #1e293b 100%)"
        glow="rgba(51,65,85,0.50)"
      >
        <h4 style={cardTitle}>Screens are private. Ledgers are not.</h4>
        <p style={cardText}>
          When someone glances at your phone, borrows your device, or a
          screenshot circulates, the amount is not visible. What stays public
          is the transaction itself: any address can be looked up on BscScan,
          and every movement can be verified by anyone who cares to check.
        </p>
        <div style={divider}>
          We protect the screen, not the record. That line is deliberate.
        </div>
      </Card>

      {/* ================= 3. 不托管 · 盾牌 ================= */}
      <Card
        title="Non-Custodial"
        icon="shield"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <h4 style={cardTitle}>We never hold your funds.</h4>
        <p style={cardText}>
          UFO sits in your own address at all times. The protocol holds no key
          to your wallet and cannot move your balance. This page only builds a
          transaction and hands it to your wallet to sign — it never takes
          custody of anything.
        </p>
        <Panel>
          <b>What that means in practice:</b> closing this tab, losing the
          domain, or losing our servers does not affect your balance. Only
          your wallet does.
        </Panel>
      </Card>

      {/* ================= 4. 定价 · 天平 ================= */}
      <Card
        title="Pricing"
        icon="scale"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <h4 style={cardTitle}>Priced in dollars. Quoted on-chain.</h4>
        <p style={cardText}>
          UFO uses the US dollar as its unit of account, and 1 UFO equals
          1 USD. The rate is not set by a private server — every quote is
          computed by the contract itself, so what you see here is what the
          chain will execute.
        </p>
        <div style={divider}>
          Any quote can be verified independently by calling the Vault's
          read functions on BscScan.
        </div>
      </Card>

      {/* ================= 5. 即时结算 · 闪电 ================= */}
      <Card
        title="Instant Settlement"
        icon="zap"
        gradient="linear-gradient(145deg, #f59e0b 0%, #ea580c 60%, #c2410c 100%)"
        glow="rgba(234,88,12,0.50)"
      >
        <h4 style={cardTitle}>Send value like a message.</h4>
        <p style={cardText}>
          Settlement lands in the recipient's wallet in seconds. No banking
          hours, no correspondent bank, no intermediary holding the payment
          while it clears.
        </p>
      </Card>

      {/* ================= 6. 公开账本 · 分层 ================= */}
      <Card
        title="Open Ledger"
        icon="layers"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <h4 style={cardTitle}>Nothing to hide, nothing to trust.</h4>
        <p style={cardText}>
          Pool balances, total supply and every settlement are public on BNB
          Chain. There is no relay server and no backend that could be shut
          down — the interface is a static page, and the contract is the
          product.
        </p>
        <div style={divider}>
          Vault <span style={{ opacity: 0.8 }}>0xa8A3…b3a2</span> · Token{' '}
          <span style={{ opacity: 0.8 }}>0x9CB5…3eaB</span>
        </div>
      </Card>

      {/* ================= 7. 钱包直达 · 连接 ================= */}
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
          loads inside it — already connected, no approval round-trip.
        </p>
        <Panel>
          <b>On a slow connection:</b> the whole interface is 64 KB gzipped,
          so it opens where heavier dapps time out.
        </Panel>
      </Card>

      {/* ================= 8. 免责声明 · 警告 ================= */}
      <Card
        title="Disclaimer"
        icon="alert"
        gradient="linear-gradient(145deg, #fb7185 0%, #ec4899 52%, #be185d 100%)"
        glow="rgba(236,72,153,0.50)"
      >
        <h4 style={cardTitle}>A settlement instrument, not an investment.</h4>
        <p style={cardText}>
          UFO offers no yield and no speculative return. It is not a deposit.
          Redemption is settled at 1 UFO = 1 USD and is subject to pool
          liquidity, so processing may be delayed or limited. Users are solely
          responsible for ensuring their use of the protocol complies with
          local law.
        </p>
        <p style={{ ...cardText, marginTop: '10px' }}>
          UFO is not offered to persons in restricted jurisdictions including{' '}
          <b>Afghanistan, Algeria, Bangladesh, Belarus, Bolivia, China, Cuba,
          Egypt, Iran, Iraq, Morocco, Nepal, North Korea, Qatar, Russia, Syria,
          Tunisia, and Venezuela</b>, nor to residents of any jurisdiction that
          has established a stablecoin issuance licensing regime.
        </p>
      </Card>
    </div>
  );
}
