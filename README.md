<div align="center">
  <h1>🛸 UFO Dollar - Frontend DApp (Private)</h1>
  <p><strong>The Web Interface for Asset Concealment and Private Settlement.</strong></p>
</div>

<br />
<hr />

<h2>📖 Overview</h2>
<p>This is the private frontend repository for <b>UFO Dollar</b>. It provides a seamless, mobile-first interface for users to mint UFO using USDT/USDC and redeem it back, specifically designed for private commercial settlement.</p>

<h2>⚙️ Core Configuration</h2>
<p>All smart contract addresses and parameters are centralized in the <code>CONFIG</code> object at the top of <code>src/App.jsx</code>. <b>Ensure you are on BSC Mainnet.</b></p>

<table>
  <tr>
    <td width="50%">
      <h3>🛡️ Core Vault</h3>
      <p><code>0x62Eaf08612c77F944265DE421F3Bed054531cC9C</code></p>
    </td>
    <td width="50%">
      <h3>🪙 UFO Token</h3>
      <p><code>0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB</code></p>
    </td>
  </tr>
</table>

<h3>Frontend Constants</h3>
<pre><code class="language-javascript">const CONFIG = {
  VAULT_ADDRESS: '0x62Eaf08612c77F944265DE421F3Bed054531cC9C',
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  FEE_RATE: 0.005, // 0.5% Settlement Fee
};</code></pre>

<h2>🚀 Local Development</h2>
<blockquote>
  <p>💡 <b>Developer Note:</b> Use Node.js v18 or higher. Ensure you have your Reown AppKit <code>projectId</code> configured.</p>
</blockquote>

<details>
<summary><b>👉 Click to Expand Full Setup Guide</b></summary>
<br>
<b>1. Install Dependencies</b>
<pre><code class="language-bash">npm install</code></pre>

<b>2. Run Locally (Port 5173)</b>
<pre><code class="language-bash">npm run dev</code></pre>

<b>3. Build for Production</b>
<pre><code class="language-bash">npm run build</code></pre>
</details>

<h2>🛡️ Operations & Security Features</h2>

<table>
  <thead>
    <tr>
      <th align="left" width="30%">Feature</th>
      <th align="left" width="70%">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Local History</b></td>
      <td>Transactions are stored via <code>localStorage</code> to provide users with a local receipt of successful and failed transactions without backend databases.</td>
    </tr>
    <tr>
      <td><b>Dynamic Pool Check</b></td>
      <td>Before redemption, the frontend queries the Vault's real-time USDT/USDC balances to prevent failed transactions due to insufficient liquidity.</td>
    </tr>
    <tr>
      <td><b>Network Enforcement</b></td>
      <td>Forces wallet connection to BSC Mainnet (<code>chainId: 0x38</code>) to ensure contracts are called on the correct chain.</td>
    </tr>
    <tr>
      <td><b>Emergency Pause</b></td>
      <td>If the <code>UFOVault</code> contract is paused by the protocol owner, the UI will intercept the EVM revert and block Swap/Redeem actions.</td>
    </tr>
  </tbody>
</table>

<h2>📄 License</h2>
<p>This project is <b>proprietary and closed-source</b>. All rights reserved. No part of this repository may be reproduced without prior written permission from the UFO Dollar team.</p>