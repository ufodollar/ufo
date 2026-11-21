import React from 'react';
import { Card, tabWrap } from './Card';
import { SecTitle, Cl, DefTable, Note } from './Doc';

/* ============================================================
   📘 GuideTab — 产品条款
   格式：分节 + 编号条款 + 口径表，可按条引用
   口径（不得偏离）：
   1. 1 UFO 永久等于 1 USD，美元为计价单位
   2. 用户自助发行，合约只接受稳定币铸币
   3. 不写无法核验的绝对化承诺
   术语：issuance = 发行 / burn = 销毁（全站统一）
   ============================================================ */

const Addr = ({ label, value }) => (
  <div style={{ marginTop: '4px' }}>
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

export default function GuideTab() {
  return (
    <div style={tabWrap}>
      {/* ============ 01 发行 ============ */}
      <Card
        title="Section 01 · Issuance"
        icon="scale"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <SecTitle n="01">Issuance</SecTitle>

        <Cl n="1.1">
          UFO is a zero-value settlement token issued on BNB Chain. On the UFO
          Dollar platform it is priced in US dollars, and 1 UFO is permanently
          equal to 1 USD. It can replace USDT and USDC as a commercial
          settlement instrument, and, by virtue of the advantages of an
          ordinary wallet and of zero on-chain value, it holds the advantages
          of anti-theft and of resistance to hacker tracking.
        </Cl>

        <Cl n="1.2">
          <b>Statement.</b> UFO is issued by users themselves.
          <div style={{ marginTop: '7px' }}>
            <b>Issuance.</b> You deposit USDT or USDC into the self-service
            issuance machine, click the “Issuance” button, and the tokens are
            minted to your wallet address.
          </div>
          <div style={{ marginTop: '7px' }}>
            <b>Burn.</b> After you burn UFO with the self-service issuance
            machine, you obtain USDT or USDC.
          </div>
        </Cl>

        <Cl n="1.3">
          The maker of the UFO Dollar platform will not create UFO out of thin
          air. The contract code allows only stablecoins to be used for minting
          UFO. The code is the law, and it does not change.
        </Cl>

        <DefTable
          rows={[
            ['Instrument', 'UFO · BEP-20'],
            ['Network', 'BNB Chain'],
            ['Unit of account', 'USD'],
            ['Issuance price', '1.00 USD / unit'],
            ['Burn value', '1.00 USD / unit'],
            ['Fees', '0.50% issuance · 0.50% burn'],
            ['Settlement', 'Single block, atomic'],
            ['Payout currency', 'USDT or USDC held by the Vault'],
          ]}
        />

        <Note>
          <b>Note:</b> whoever holds UFO can burn it, and the contract has no
          power to freeze any UFO. Both issuance and burning require a 0.5%
          issuance / burn fee, paid to the self-service issuance machine.
        </Note>
      </Card>

      {/* ============ 02 估值 ============ */}
      <Card
        title="Section 02 · Valuation"
        icon="shield"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <SecTitle n="02">Valuation and price discovery</SecTitle>

        <Cl n="2.1">
          No price feed publishes a USD quotation for UFO. Wallets and block
          explorers therefore report a valuation of zero.
        </Cl>

        <Cl n="2.2">
          The USD amount is determined at burn. The holder tenders UFO to the
          Vault and receives USDT or USDC; that instruction is the only point
          at which a USD figure is recognised.
        </Cl>

        <Cl n="2.3">
          The unit price is a constant in the contract bytecode. No parameter,
          key or administrative function can revise it.
        </Cl>

        <Note>
          The figure shown on this site is read from the contract at page load.
          It reproduces the contract value; it cannot set it. The same figure
          is returned by the Vault's read functions on BscScan.
        </Note>
      </Card>

      {/* ============ 03 持有与授权 ============ */}
      <Card
        title="Section 03 · Custody"
        icon="globe"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <SecTitle n="03">Custody and signing authority</SecTitle>

        <Cl n="3.1">
          Units are held at the holder's address. The platform holds no private
          key and no signing authority over holder balances.
        </Cl>

        <Cl n="3.2">
          Every transfer requires the holder's signature. Without it, no balance
          changes.
        </Cl>

        <Cl n="3.3">
          Both contract addresses are published on every page. Verify them
          against BscScan before signing. A mismatch indicates a replica site
          and the instruction should be rejected.
        </Cl>
      </Card>

      {/* ============ 04 结算 ============ */}
      <Card
        title="Section 04 · Settlement"
        icon="zap"
        gradient="linear-gradient(145deg, #f59e0b 0%, #ea580c 60%, #c2410c 100%)"
        glow="rgba(234,88,12,0.50)"
      >
        <SecTitle n="04">Settlement cycle and finality</SecTitle>

        <Cl n="4.1">
          A transfer is included in one block and reaches finality under BNB
          Chain's own finality rule. No cut-off time applies.
        </Cl>

        <Cl n="4.2">
          No correspondent bank, settlement agent or intermediary is involved.
          The Vault is the sole counterparty on burn.
        </Cl>

        <Cl n="4.3">
          Recorded fields are payer, payee, amount and block timestamp. The USD
          amount is not among them.
        </Cl>
      </Card>

      {/* ============ 05 账本 ============ */}
      <Card
        title="Section 05 · Ledger"
        icon="layers"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <SecTitle n="05">Public ledger and system architecture</SecTitle>

        <Cl n="5.1">
          Vault balances, total supply and every transfer are public on BNB
          Chain and verifiable without the platform's cooperation.
        </Cl>

        <Cl n="5.2">
          The interface is a static page. It holds no server-side component, no
          custody function and no database of holder positions.
        </Cl>

        <Cl n="5.3">
          Contract addresses:
          <Addr label="Vault" value="0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2" />
          <Addr label="Token" value="0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB" />
        </Cl>
      </Card>

      {/* ============ 06 法律声明 ============ */}
      <Card
        title="Section 06 · Legal"
        icon="alert"
        gradient="linear-gradient(145deg, #fb7185 0%, #ec4899 52%, #be185d 100%)"
        glow="rgba(236,72,153,0.50)"
      >
        <SecTitle n="06">Legal notice</SecTitle>

        <Cl n="6.1">
          UFO pays no yield and confers no profit participation. Burning settles
          at 1 UFO = 1 USD and is funded from the USDT and USDC balances held by
          the Vault.
        </Cl>

        <Cl n="6.2">
          Whether the instrument may be acquired or held is determined by the
          law applicable to the holder. That assessment rests with the holder.
        </Cl>

        <Cl n="6.3">
          UFO is not offered to persons in restricted jurisdictions including{' '}
          <b>Afghanistan, Algeria, Bangladesh, Belarus, Bolivia, China, Cuba,
          Egypt, Iran, Iraq, Morocco, Nepal, North Korea, Qatar, Syria,
          Tunisia, and Venezuela</b>, nor to residents of any jurisdiction that
          has established a stablecoin issuance licensing regime.
        </Cl>
      </Card>
    </div>
  );
}
