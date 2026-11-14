<div align="center">
  <h1>🛸 UFO Dollar - Frontend DApp</h1>
  <p><strong>Private Repository for the UFO Dollar Web Interface</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Status-Production_Ready-success?style=flat-square" alt="Status">
    <img src="https://img.shields.io/badge/Framework-React_Vite-blue?style=flat-square" alt="React">
    <img src="https://img.shields.io/badge/Web3-Ethers.js_v6-purple?style=flat-square" alt="Ethers">
    <img src="https://img.shields.io/badge/Wallet-Reown_AppKit-black?style=flat-square" alt="Reown">
  </p>
</div>

<br />

> ⚠️ **CRITICAL NOTICE FOR DEVELOPERS**
> This is a private internal repository. Do not expose proprietary business logic. If the `UFOVault.sol` or `UFOToken.sol` contracts are upgraded, update the addresses here immediately. If the production domain changes, you MUST update the allowed domains in the Reown AppKit dashboard.

<h2>⚙️ Core Configuration</h2>
<p>All smart contract addresses, network parameters, and fee rates are centralized in the <code>CONFIG</code> object at the top of <code>src/App.jsx</code>:</p>

<pre><code class="language-javascript">const CONFIG = {
  VAULT_ADDRESS: '0x62Eaf08612c77F944265DE421F3Bed054531cC9C', // Dual-Collateral Vault
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB', // UFO Token
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  FEE_RATE: 0.005,
};</code></pre>

<h2>🚀 Local Development</h2>
<blockquote>
  <p>💡 <strong>Quick Start Guide</strong></p>
  <p>Follow these steps to spin up the local development environment.</p>
</blockquote>

<h3>1. Install Dependencies</h3>
<pre><code class="language-bash">npm install</code></pre>

<h3>2. Start Local Server (Port 5173)</h3>
<pre><code class="language-bash">npm run dev</code></pre>

<h3>3. Build for Production</h3>
<pre><code class="language-bash">npm run build</code></pre>

<h2>☁️ Deployment & Operations</h2>
<blockquote>
  <p>🛡️ <strong>Internal Runbook & Security Procedures</strong></p>
  <p>Follow these steps immediately if something goes wrong.</p>
</blockquote>

<table>
  <tr>
    <td width="30%"><strong>Hosting</strong></td>
    <td>Deployed via Cloudflare Pages. Auto-deploys on push to <code>main</code> branch.</td>
  </tr>
  <tr>
    <td><strong>Network Enforcement</strong></td>
    <td><code>ensureBscNetwork</code> forces wallet connection to BSC Mainnet (<code>chainId: 0x38</code>).</td>
  </tr>
  <tr>
    <td><strong>Polling</strong></td>
    <td>User balances are polled every 5 seconds to reflect the latest on-chain state.</td>
  </tr>
  <tr>
    <td><strong>Emergency Pause</strong></td>
    <td>If <code>UFOVault</code> is paused by the contract owner, the UI intercepts the EVM revert and blocks Swap/Redeem actions.</td>
  </tr>
  <tr>
    <td><strong>IPFS Backup</strong></td>
    <td>If Cloudflare goes down, deploy the <code>dist/</code> folder to Fleek or Pinata.</td>
  </tr>
</table>

<h2>🐞 Troubleshooting</h2>
<ul>
  <li><strong>Wallet Connect Fails to Pop Up:</strong> Check if the <code>projectId</code> is valid and if the current domain is whitelisted in the Reown Dashboard.</li>
  <li><strong>Balances Show 0:</strong> Ensure the user is on BSC Mainnet. The public RPC node might occasionally rate-limit; consider switching to a private RPC provider.</li>
  <li><strong>Transaction Stuck on "Processing":</strong> The user might have rejected the transaction in their wallet, or the gas fee is too low. Check the browser console for the specific ethers.js error.</li>
</ul>

<br />

<div align="center">
  <i>UFO Dollar - Proprietary & Closed-Source. All rights reserved.</i>
</div>