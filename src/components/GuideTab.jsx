import React from 'react';
import { Card, Panel, cardTitle, cardText, divider, tabWrap } from './Card';

/* ============================================================
   📘 GuideTab — 产品说明
   定位：防盗 + 结算隐私的稳定币，1 UFO 恒等于 1 USD
   原则：
   1. 价格说清（1:1），流动性风险说清（池内实际持有）
   2. 「隐私」只讲显示层，同时主动说明链上公开
   3. 不做任何监管状态、审计、储备的陈述
   4. 不写无法验证的绝对化承诺（如「资金永远安全」）
   ============================================================ */
export default function GuideTab() {
  return (
    <div style={tabWrap}>
      {/* ================= 1. 防盗结算 · 盾牌 ================= */}
      <Card
        title="Anti-Theft Settlement Stablecoin"
        icon="shield"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <h4 style={cardTitle}>A balance thieves scroll past.</h4>

        <p style={cardText}>
          Automated drainers sweep wallet addresses and rank them by visible
          balance. A wallet that reads <b>$0.00</b> gets skipped — not because
          it is empty, but because it does not look worth the gas. The same
          holds for a glance over your shoulder, a shared screen, or a
          screenshot that travels through a group chat.
        </p>

        <Panel>
          <b>Where it stops:</b> a leaked seed phrase still loses the tokens,
          and no token design can prevent that. What UFO removes is the
          visible target — the balance that makes an address worth attacking
          in the first place.
        </Panel>
      </Card>

      {/* ================= 2. 定价 · 天平 ================= */}
      <Card
        title="Pricing"
        icon="scale"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <h4 style={cardTitle}>One UFO, one dollar.</h4>

        <p style={cardText}>
          The unit price of 1 UFO is always equal to 1 US dollar. The dollar
          serves as the unit of account, and every quote is computed by the
          contract itself rather than by a private server — so what this page
          shows is what the chain will execute.
        </p>

        <div style={divider}>
          Any quote can be checked on BscScan by calling the Vault's read
          functions directly.
        </div>
      </Card>

      {/* ================= 3. 旁人看到什么 · 锁 ================= */}
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

      {/* ================= 4. 自持 · 地球 ================= */}
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
          <b>Check before you sign:</b> the Vault and token addresses are
          printed on every page. If they differ from the ones on BscScan, stop.
        </Panel>
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
          hours, and no intermediary holding the payment while it clears.
        </p>
      </Card>

      {/* ================= 6. 公开账本 · 分层 ================= */}
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
          <b>On a slow connection:</b> the whole interface is under 70 KB
          gzipped, so it opens where heavier dapps time out.
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
          Egypt, Iran, Iraq, Morocco, Nepal, North Korea, Qatar, Syria,
          Tunisia, and Venezuela</b>, nor to residents of any jurisdiction that
          has established a stablecoin issuance licensing regime.
        </p>
      </Card>
    </div>
  );
}
