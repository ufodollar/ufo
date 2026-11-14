# UFO Dollar - Protocol Core & Smart Contracts

Smart contract architecture for **UFO Dollar**, a dual-collateral, USD-pegged settlement stablecoin on BNB Smart Chain (BSC).

## 🔗 Live Deployments (BSC Mainnet)

*   **UFOVault (Dual-Collateral Core):** [0x62Eaf08612c77F944265DE421F3Bed054531cC9C](https://bscscan.com/address/0x62Eaf08612c77F944265DE421F3Bed054531cC9C)
*   **UFOToken (ERC20):** [0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB](https://bscscan.com/address/0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB)

## ✨ Core Architecture

*   **Dual-Collateral:** Accepts both USDT and USDC. Reserves are tracked independently via mapping.
*   **Zero-Slippage:** Hardcoded 1:1 peg (1 USDT/USDC = 1 UFO). No AMM liquidity pools involved.
*   **Oracle-Free:** No external price feeds required for minting/redeeming.
*   **0.5% Protocol Fee:** Applied on both deposit and withdraw.

## 🛠 Tech Stack

*   **Smart Contracts:** Solidity ^0.8.20
*   **Framework:** Foundry (Forge)
*   **Libraries:** OpenZeppelin (ReentrancyGuard, Pausable, AccessControl)
*   **CI/CD:** GitHub Actions

## 🚀 Local Development & Testing

~~~bash
git clone https://github.com/ufodollar/bsc-vault.git
cd bsc-vault
forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
forge build
forge test
~~~

### Environment Variables

Create a `.env` file at the root for deployment:

~~~env
PRIVATE_KEY=your_wallet_private_key
BSC_RPC_URL=https://bsc-dataseed.binance.org
~~~

### Deployment to BSC Mainnet

~~~bash
forge create src/UFOVault.sol:UFOVault --rpc-url $BSC_RPC_URL --private-key $PRIVATE_KEY --constructor-args 0x55d398326f99059fF775485246999027B3197955 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d 0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB <FEE_RECIPIENT_ADDRESS>
~~~

## 🛡 Security

*   Only `UFOVault` holds `MINTER_ROLE` and `BURNER_ROLE`.
*   `Pausable` mechanism for emergency halts.
*   All transactions and balances are fully verifiable on BscScan.

## 📄 License

This project is licensed under the MIT License.