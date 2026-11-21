import React from 'react';
import { Card, tabWrap } from './Card';
import { SecTitle, Cl, DefTable, Note } from './Doc';

/* ============================================================
   📋 RulesTab — 执行规则
   格式：与 GuideTab 同一套条款体，可按条引用
   原则：
   1. 每句给确定结论，不写「可能」「通常」「建议」
   2. 费率只在一节出现，避免两处数字互相打架
   3. 交叉引用统一写成 Guide §x.x
   ============================================================ */

export default function RulesTab() {
  return (
    <div style={tabWrap}>
      {/* ============ 01 费率与执行 ============ */}
      <Card
        title="Section 01 · Execution"
        icon="exchange"
        gradient="linear-gradient(145deg, #38bdf8 0%, #3b82f6 50%, #1d4ed8 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <SecTitle n="01">Issuance, burning and fee schedule</SecTitle>

        <Cl n="1.1">
          Issuance is charged 0.50% of notional. Burning is charged 0.50% of
          notional. Fees are charged at execution and are non-refundable.
        </Cl>

        <Cl n="1.2">
          The fee and the net proceeds are displayed before signature. No
          further deduction is applied after execution.
        </Cl>

        <Cl n="1.3">
          Proceeds of a burn are paid in the currency the Vault holds. Where USDT
          capacity is insufficient for the instruction, payment is made in
          USDC; where USDC capacity is insufficient, payment is made in USDT.
        </Cl>

        <Cl n="1.4">
          Capacity on both sides is displayed prior to signature, so the payout
          currency is selected from reported balances rather than from a failed
          transaction.
        </Cl>

        <Cl n="1.5">
          The settlement venue is BNB Chain. UFO is not issued on any other
          network. In Bitget Wallet, select <b>BNB Chain</b> (displayed as BSC)
          at the network prompt.
        </Cl>

        <DefTable
          rows={[
            ['Issuance fee', '0.50% of notional'],
            ['Burn fee', '0.50% of notional'],
            ['Bid / offer spread', 'Nil'],
            ['Network gas', 'Payable to BNB Chain'],
            ['Settlement venue', 'BNB Chain only'],
            ['Quote source', 'Vault contract, read call'],
          ]}
        />
      </Card>

      {/* ============ 02 交易序列 ============ */}
      <Card
        title="Section 02 · Sequence"
        icon="zap"
        gradient="linear-gradient(145deg, #8b5cf6 0%, #7c3aed 55%, #5b21b6 100%)"
        glow="rgba(124,58,237,0.50)"
      >
        <SecTitle n="02">Transaction sequence</SecTitle>

        <Cl n="2.1">
          <b>Authorisation.</b> The first issuance of a token requires one
          allowance, scoped to that token and that amount. It grants no other
          permission.
        </Cl>

        <Cl n="2.2">
          <b>Issuance.</b> Enter the notional. The rate is read from the
          contract and the unit amount is computed on-chain. No server performs
          this calculation.
        </Cl>

        <Cl n="2.3">
          <b>Burn.</b> Tender UFO to the Vault for burning and receive the
          stablecoin at 1 UFO = 1 USD, subject to available capacity under §1.3.
        </Cl>

        <Cl n="2.4">
          Each step is a separate transaction and requires a separate
          signature.
        </Cl>

        <Note>
          An allowance is not a transfer. It permits the Vault to move the
          stated amount of that token, once.
        </Note>
      </Card>

      {/* ============ 03 钱包操作 ============ */}
      <Card
        title="Section 03 · Access"
        icon="wallet"
        gradient="linear-gradient(145deg, #6366f1 0%, #4f46e5 55%, #3730a3 100%)"
        glow="rgba(79,70,229,0.50)"
      >
        <SecTitle n="03">Wallet operation — Bitget Wallet</SecTitle>

        <Cl n="3.1">
          Select the Bitget Wallet entry. On mobile the link opens the
          application. If the application is not installed, the link redirects
          to the download page after two seconds.
        </Cl>

        <Cl n="3.2">
          If the application requests a network, select <b>BNB Chain</b>
          (displayed as BSC). The request originates from the wallet, not from
          this site.
        </Cl>

        <Cl n="3.3">
          The page loads inside the application's browser. The provider is
          injected on load; no QR pairing and no relay session are used.
        </Cl>

        <Cl n="3.4">
          Select Connect and approve the connection. This associates the address
          with the page. It moves no funds and consumes no gas.
        </Cl>

        <Cl n="3.5">
          Enter the notional and sign. Subsequent sessions restore the
          association without a further prompt.
        </Cl>

        <Note>
          If the application opens on its home screen, use <b>Discover</b> and
          reopen this site from the browsing history.
        </Note>
      </Card>

      {/* ============ 04 风险标记解释 ============ */}
      <Card
        title="Section 04 · Risk flags"
        icon="alert"
        gradient="linear-gradient(145deg, #fb7185 0%, #ec4899 52%, #be185d 100%)"
        glow="rgba(236,72,153,0.50)"
      >
        <SecTitle n="04">Interpretation of wallet risk flags</SecTitle>

        <Cl n="4.1">
          Wallet providers apply automated risk scoring to domains and
          contracts. A newly deployed contract and a new domain carry no scoring
          history and are returned as unrated.
        </Cl>

        <Cl n="4.2">
          <b>“Suspicious site” / “Unverified domain”.</b> The domain is absent
          from the provider's allowlist. This is a heuristic applied to unseen
          domains; it is not a malware determination.
        </Cl>

        <Cl n="4.3">
          <b>“Unverified contract”.</b> No prior interaction exists between the
          contract and the connected address. The flag clears with use.
        </Cl>

        <Cl n="4.4">
          <b>“No price”.</b> Consistent with Guide §2.1. No quotation is
          published for UFO, so the provider reports zero.
        </Cl>

        <Cl n="4.5">
          <b>Independent verification.</b> Compare the Vault address with
          BscScan and review its transaction history. A matching address with
          recorded activity supports a novelty reading of the flag.
        </Cl>
      </Card>

      {/* ============ 05 签署前控制 ============ */}
      <Card
        title="Section 05 · Controls"
        icon="shield"
        gradient="linear-gradient(145deg, #10b981 0%, #059669 55%, #065f46 100%)"
        glow="rgba(5,150,105,0.50)"
      >
        <SecTitle n="05">Pre-signature controls</SecTitle>

        <Cl n="5.1">
          Access the site only through the published domain. Maintain a
          bookmark; links received in messages and advertisements are the
          standard route to a replica site.
        </Cl>

        <Cl n="5.2">
          Verify both contract addresses before signing. They are printed on
          every page and on BscScan.
        </Cl>

        <Cl n="5.3">
          A seed phrase is never required by the platform. No recovery service
          exists for a self-custody wallet.
        </Cl>

        <Cl n="5.4">
          Review the allowance scope. Reject any request for unlimited
          approval.
        </Cl>
      </Card>

      {/* ============ 06 异常处理 ============ */}
      <Card
        title="Section 06 · Exceptions"
        icon="info"
        gradient="linear-gradient(145deg, #06b6d4 0%, #0891b2 55%, #0e7490 100%)"
        glow="rgba(8,145,178,0.50)"
      >
        <SecTitle n="06">Exception handling</SecTitle>

        <Cl n="6.1">
          The five conditions below account for most reported failures.
        </Cl>

        <DefTable
          rows={[
            ['Transaction pending', 'Await inclusion or replace'],
            ['Wallet entry unresponsive', 'Open the application, retry'],
            ['Connection fails', 'Network mismatch — select BSC'],
            ['Valuation shows 0.00', 'Expected — Guide §2.1'],
            ['Capacity insufficient', 'Reduce the notional'],
          ]}
        />

        <Cl n="6.2">
          Unresolved cases: write to <b>ufodollar6@gmail.com</b> with the
          address and the transaction hash. No third party is authorised to
          recover funds, and any such offer should be treated as fraudulent.
        </Cl>
      </Card>
    </div>
  );
}
