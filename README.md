UFO Dollar - Frontend DApp (Private)

Internal repository for the official UFO Dollar Frontend DApp. This interface facilitates zero-slippage B2B settlement on BNB Smart Chain (BSC), enabling users to mint and redeem the USD-pegged UFO stablecoin using USDT or USDC.

🛠 Tech Stack

· Framework: React (Vite)
· Web3 Integration: Ethers.js v6
· Wallet Connection: Reown AppKit (formerly WalletConnect)
· Styling: Pure CSS-in-JS (React inline styles)
· Deployment: Cloudflare Pages

⚙️ Core Configuration

All smart contract addresses, network parameters, and fee rates are centralized in the CONFIG object at the top of src/App.jsx.

```javascript
const CONFIG = {
  VAULT_ADDRESS: '0x62Eaf08612c77F944265DE421F3Bed054531cC9C', // Dual-Collateral Vault
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  FEE_RATE: 0.005,
};
```

⚠️ CRITICAL NOTICE: If the UFOVault.sol or UFOToken.sol contracts are upgraded/redeployed, the VAULT_ADDRESS or UFO_ADDRESS in this file MUST be updated immediately. Push the change to the main branch to trigger a Cloudflare rebuild.

🚀 Local Development

Prerequisites

· Node.js (v18 or higher)
· npm or yarn

1. Install Dependencies

```bash
npm install
```

2. Start Local Server

```bash
npm run dev
```

The application will be available at http://localhost:5173.

3. Build for Production

```bash
npm run build
```

☁️ Deployment Pipeline

· Hosting: The DApp is hosted on Cloudflare Pages.
· CI/CD: Pushing code to the main branch automatically triggers a production build and deployment.
· Branch Management: Use dev or feature branches for testing. All pull requests require review before merging into main.

🛡️ Security & Emergency Operations

Environment & Privacy

· This is a private repository. Do not expose proprietary business logic or internal API keys.
· The Reown Project ID (d643...) is public-facing and safe to expose in the client, but keep any future RPC keys or backend secrets in Cloudflare Environment Variables (e.g., VITE_ prefix).

Smart Contract Interaction & Pause

· Transaction Reverts: The frontend is designed to catch and display EVM revert reasons (e.g., UnsupportedToken, Insufficient balance, Pausable: paused).
· Emergency Kill Switch: If a vulnerability is detected in the UFOVault contract, the contract owner must call the pause() function via BscScan. The frontend will automatically block Swap and Redeem attempts and surface the error to the user.

Decentralized Backup

· In the event of a Cloudflare domain ban or outage, the static build (dist/ directory) can be deployed to IPFS (via Fleek or Pinata) to maintain uninterrupted access to the protocol.