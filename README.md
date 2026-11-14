UFO Dollar - Protocol Core & Architecture

UFO Dollar is a privacy-preserving, USD-pegged settlement stablecoin built on BNB Smart Chain (BSC). It is designed specifically for B2B cross-border trade, enterprise payroll, and institutional fund clearing.

By operating as a closed-loop settlement network with no public liquidity pools, UFO eliminates the price volatility and exposure of commercial transaction data associated with traditional decentralized finance (DeFi).

🔗 Live Deployments (BSC Mainnet)

· UFOVault (Dual-Collateral Core): 0x62Eaf08612c77F944265DE421F3Bed054531cC9C
· UFOToken (ERC20): 0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB

✨ Core Architecture & Features

1. Multi-Collateral Resilience (Risk Isolation)

To mitigate the systemic risk of a single stablecoin issuer (e.g., Tether or Circle) freezing funds due to regulatory actions, the UFOVault utilizes a dual-collateral architecture.

· Accepts both USDT and USDC as minting collateral.
· Reserves are isolated independently on-chain (mapping(address => uint256) public totalReserves).
· If one asset pool is compromised or frozen, the other pool remains fully operational, ensuring uninterrupted redemption for merchants.

2. Strict 1:1 USD Peg (Zero-Slippage)

Unlike AMM-based DEXs, UFO does not rely on public liquidity pools.

· 1 USDT/USDC = $1.00 USD = 1 UFO (minus a 0.5% protocol fee).
· There is zero slippage, regardless of transaction size. This provides a highly predictable and stable settlement route for institutional traders.

3. Oracle-Free Stability

The UFOVault contract does not rely on external price feeds (such as Chainlink) to calculate minting or redemption rates. The exchange rate is mathematically hardcoded to 1:1. This entirely eliminates the risk of oracle manipulation, flash-loan price attacks, or price-feed latency exploits.

4. Closed-Loop Privacy Architecture

UFO is not listed on any public exchange and has no public liquidity pools. It operates exclusively as a permissionless settlement network.

· By avoiding public DEXs, enterprise trade secrets, transaction sizes, and counterparties are shielded from public block explorers and on-chain analysts.
· The asset is isolated from market speculation, ensuring it remains a pure medium for enterprise fund clearing.

5. Bilateral Settlement Fee (0.5%)

A transparent 0.5% protocol fee is applied on both deposit (Mint) and withdraw (Redeem).

· Not-for-profit structure: The fee is strictly used to fund ongoing infrastructure maintenance, smart contract security audits, and global developer adoption.
· The fee is routed directly to a designated treasury address, ensuring the protocol remains self-sustaining without relying on token inflation.

🛠 Tech Stack

· Smart Contracts: Solidity ^0.8.20
· Development Framework: Foundry (Forge)
· Security Libraries: OpenZeppelin Contracts (ReentrancyGuard, Pausable, AccessControl, SafeERC20)
· Frontend Interface: React, Vite, Reown AppKit (Ethers.js)
· CI/CD: GitHub Actions (Automated smart contract deployment and role management on BSC)

🚀 Local Development

Prerequisites

Ensure you have Foundry installed on your local machine.

1. Clone & Install Dependencies

```bash
git clone https://github.com/ufodollar/bsc-vault.git
cd bsc-vault
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
```

2. Compile Contracts

```bash
forge build
```

3. Run Tests

```bash
forge test
```

4. Deploy to BSC Mainnet

Ensure your .env file contains your PRIVATE_KEY and RPC_URL. Deploy using the following Foundry command:

```bash
forge create src/UFOVault.sol:UFOVault \
  --rpc-url https://bsc-dataseed.binance.org \
  --private-key $PRIVATE_KEY \
  --constructor-args \
  0x55d398326f99059fF775485246999027B3197955 \
  0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d \
  0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB \
  <FEE_RECIPIENT_ADDRESS>
```

🛡 Security & Transparency

· Role-Based Access Control (RBAC): The UFOToken utilizes OpenZeppelin's AccessControl. Only the deployed UFOVault contract is granted the MINTER_ROLE and BURNER_ROLE. No external entity or developer wallet can arbitrarily mint UFO.
· Emergency Pause Mechanism: The UFOVault includes a Pausable function controlled by the protocol owner, allowing the team to halt deposits and withdrawals in the event of an unforeseen vulnerability.
· On-Chain Verifiability: All vault balances, reserve allocations (USDT vs. USDC), minting activities, and fee distributions are fully transparent and verifiable on BscScan.

⚠️ Disclaimer

UFO is a payment instrument and settlement infrastructure, not an investment product. It does not offer yields or speculative returns. Users and institutional clients are solely responsible for ensuring their use of the protocol complies with the laws of their local jurisdiction. UFO is not offered to persons or entities located in restricted or comprehensively sanctioned jurisdictions.

📄 License

This project is licensed under the MIT License.