UFO Dollar - Frontend DApp

The official open-source frontend interface for the UFO Dollar protocol, a universal crypto settlement stablecoin infrastructure deployed on BNB Smart Chain (BSC).

This DApp provides a seamless, user-friendly interface for interacting with the UFOVault smart contracts, enabling users to mint (deposit USDT) and redeem (withdraw USDT) UFO tokens seamlessly.

🔗 Related Repositories

· Smart Contracts & ZK Module: bsc-vault

🛠 Tech Stack

· Framework: React (Vite)
· Web3 Interaction: Ethers.js v6
· Wallet Connection: Reown AppKit (formerly WalletConnect)
· Network: BNB Smart Chain (BSC)

✨ Core Features

· Multi-Wallet Support: Seamless connection via Reown AppKit supporting MetaMask, TrustWallet, and other major Web3 wallets.
· Automated Network Switching: Prompts users to add/switch to BNB Smart Chain if not already connected.
· Real-time Balance Polling: Displays live balances for native BNB (for gas) and ERC20 tokens (USDT, UFO).
· Oracle Integration: Fetches real-time BNB price via Chainlink Oracles to display accurate fiat equivalents.
· Transparent Fee Routing: Clearly displays the 0.5% settlement fee and net received amounts before transaction execution.
· Responsive UI: Mobile-first design ensuring a smooth experience across all devices.

🚀 Local Development

Prerequisites

Make sure you have Node.js (v18+) and npm installed.

1. Install Dependencies

```bash
npm install
```

2. Environment Variables

Create a .env file in the root directory and configure the following variables (see .env.example for reference):

```env
VITE_REOWN_PROJECT_ID=your_reown_project_id
VITE_VAULT_ADDRESS=0xYourVaultContractAddress
VITE_UFO_ADDRESS=0xYourUfoTokenAddress
VITE_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
VITE_RPC_URL=https://bsc-dataseed.bnbchain.org
```

3. Run Local Server

```bash
npm run dev
```

The app will be available at http://localhost:5173.

4. Build for Production

```bash
npm run build
```

🛡 Security & Transparency

· Non-Custodial: This frontend never has access to user private keys. All transactions are signed locally via the user's wallet.
· Transparent Operations: The frontend simply reflects the on-chain state of the UFOVault. All admin controls (pause, fee recipient) are governed by the smart contract and publicly visible on BscScan.
· Open Source: This project is licensed under the MIT License.

📄 License

This project is licensed under the MIT License.

🌐 Official Links

· Website / DApp: https://ufo-eea.pages.dev
· Twitter (X): @ufodollar
· Telegram: @ufodollar