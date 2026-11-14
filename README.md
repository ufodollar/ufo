<div align="center">
  <!-- 标题 -->
  <h1>🛸 UFO Dollar - Frontend DApp</h1>
  
  <!-- 简介 -->
  <p><strong>The Official Web Interface for the Next-Generation B2B Settlement Stablecoin.</strong></p>
  
  <!-- 极限装饰：超粗的彩色徽章矩阵 -->
  <p>
    <img src="https://img.shields.io/badge/Status-Production--Ready-success?style=for-the-badge&logo=checkmarx" alt="Status">
    <img src="https://img.shields.io/badge/Network-BSC_MAINNET-F3BA2F?style=for-the-badge&logo=binance" alt="Network">
    <img src="https://img.shields.io/badge/Framework-React_Vite-61DAFB?style=for-the-badge&logo=react" alt="React">
    <img src="https://img.shields.io/badge/Web3-Ethers.js_v6-3C3C3D?style=for-the-badge&logo=ethereum" alt="Ethers">
    <img src="https://img.shields.io/badge/Wallet-Reown_AppKit-black?style=for-the-badge&logo=walletconnect" alt="Reown">
    <img src="https://img.shields.io/badge/Security-Private_Repo-red?style=for-the-badge&logo=shieldsdotio" alt="Security">
  </p>

  <!-- 快速导航（类似按钮的效果） -->
  <p>
    <kbd>🚀 Quick Start</kbd> &nbsp; • &nbsp; 
    <kbd>🛡️ Security</kbd> &nbsp; • &nbsp; 
    <kbd>⚙️ Config</kbd> &nbsp; • &nbsp; 
    <kbd>🐞 Debug</kbd>
  </p>
</div>

<br />
<hr />

<h2>⚙️ Core Configuration</h2>
<p>All smart contract addresses and parameters are centralized in <code>src/App.jsx</code>. <b>Ensure you are on BSC Mainnet.</b></p>

<!-- 表格模拟卡片布局 -->
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

<hr />

<h2>🚀 Local Development</h2>

> 💡 **Developer Note:** Use Node.js v18 or higher. Ensure you have your `projectId` configured for Reown AppKit.

<details>
<summary><b>👉 Click to Expand Full Setup Guide</b></summary>
<br>

**1. Install Dependencies**
<pre><code class="language-bash">npm install</code></pre>

**2. Run Locally (Port 5173)**
<pre><code class="language-bash">npm run dev</code></pre>

**3. Build for Production**
<pre><code class="language-bash">npm run build</code></pre>

</details>

<hr />

<h2>🛡️ Internal Runbook (Emergency)</h2>

> ⚠️ **CRITICAL:** If a vulnerability is detected, the protocol owner must act immediately.

<table>
  <thead>
    <tr>
      <th align="left" width="30%">Scenario</th>
      <th align="left" width="70%">Action Required</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Vault Hacked/Frozen</b></td>
      <td>1. Call <code>pause()</code> on BscScan.<br>2. UI auto-blocks swaps.<br>3. Notify TG/X.</td>
    </tr>
    <tr>
      <td><b>Cloudflare Outage</b></td>
      <td>Build locally (<code>npm run build</code>) and upload <code>dist/</code> to IPFS (Fleek/Pinata).</td>
    </tr>
    <tr>
      <td><b>WalletConnect Fails</b></td>
      <td>Verify <code>projectId</code> and domain whitelist in Reown Dashboard.</td>
    </tr>
  </tbody>
</table>

<br />

<div align="center">
  <p><i>UFO Dollar - Proprietary & Closed-Source.</i></p>
  <img src="https://forthebadge.com/images/badges/built-with-love.svg" height="28">
  <img src="https://forthebadge.com/images/badges/powered-by-black-magic.svg" height="28">
</div>