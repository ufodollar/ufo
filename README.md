<div align="center">
  <h1>🛸 UFO Dollar - Frontend DApp</h1>
  <p><strong>The Web Interface for Asset Concealment and Private Settlement.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Status-Production--Ready-success?style=for-the-badge&logo=checkmarx" alt="Status">
    <img src="https://img.shields.io/badge/Framework-React_Vite-61DAFB?style=for-the-badge&logo=react" alt="React">
    <img src="https://img.shields.io/badge/Web3-Ethers.js_v6-3C3C3D?style=for-the-badge&logo=ethereum" alt="Ethers">
    <img src="https://img.shields.io/badge/Wallet-Reown_AppKit-black?style=for-the-badge&logo=walletconnect" alt="Reown">
    <img src="https://img.shields.io/badge/Security-Private_Repo-red?style=for-the-badge&logo=shieldsdotio" alt="Security">
  </p>

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
<p>All smart contract addresses and parameters are centralized in <code>src/config.js</code>. <b>Ensure you are on BSC Mainnet.</b></p>

<table>
  <tr>
    <td width="50%">
      <h3>🛡️ Core Vault</h3>
      <p><code>0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2</code></p>
    </td>
    <td width="50%">
      <h3>🪙 UFO Token</h3>
      <p><code>0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB</code></p>
    </td>
  </tr>
</table>

<h3>Frontend Constants</h3>
<pre><code class="language-javascript">const CONFIG = {
  VAULT_ADDRESS: '0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2',
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  FEE_RATE: 0.005, // 0.5% Settlement Fee
};</code></pre>

<h2>⚡ 首屏加载策略（为什么它这么快）</h2>
<p>这个页面刻意只让「打开就要用」的东西进主包，其余全部按需下载。</p>
<table>
  <tr><th>模块</th><th>何时加载</th><th>大小（min / gzip）</th></tr>
  <tr><td>React + UI + 读链层</td><td>首屏必需</td><td>≈200KB / 63KB</td></tr>
  <tr><td>WalletConnect（AppKit）</td><td>点「Connect」且浏览器里没有注入钱包时</td><td>≈1.5MB / 460KB</td></tr>
  <tr><td>Ethers.js</td><td>点「Swap」第一次签名前（输入金额时即预取）</td><td>≈180KB / 72KB</td></tr>
</table>
<p>三个设计决定值得记住，改代码时不要退回去：</p>
<ol>
  <li><b>读链不用 ethers。</b> 所有读取都是 <code>eth_call</code>，参数只有 <code>address</code> / <code>uint256</code> 两种，<code>src/chain.js</code> 里手写了编码，省下 270KB。</li>
  <li><b>AppKit 不能静态 import。</b> 一旦写在文件顶部，1.5MB 就会跟着首屏一起下载，这是之前「网页变慢」的真正原因。</li>
  <li><b>有钱包注入时永远不加载 AppKit。</b> 钱包 App 内置浏览器、装了扩展的桌面浏览器都走 EIP-1193 直连，零下载、几十毫秒连上。</li>
</ol>

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

<h2>🛡️ Operations &amp; Security Features</h2>

<table>
  <thead>
    <tr>
      <th align="left" width="30%">Feature</th>
      <th align="left" width="70%">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><b>Asset Camouflage</b></td>
      <td>The frontend relies on UFO's lack of public price feeds. Users see $0.00 values in standard wallets, ensuring unassuming transfers and private commercial settlements.</td>
    </tr>
    <tr>
      <td><b>Local History Log</b></td>
      <td>Transactions are tracked locally via <code>localStorage</code>, providing users with a private receipt of successful and failed transactions.</td>
    </tr>
    <tr>
      <td><b>Dynamic Pool Check</b></td>
      <td>Before redemption, the UI queries the Vault's real-time USDT/USDC balances to prevent failed transactions due to insufficient pool liquidity.</td>
    </tr>
    <tr>
      <td><b>Emergency Pause</b></td>
      <td>If the <code>UFOVault</code> contract is paused by the owner, the UI intercepts the EVM revert and blocks all Swap/Redeem actions.</td>
    </tr>
  </tbody>
</table>

<h2>📄 License</h2>
<p>This project is <b>proprietary and closed-source</b>. All rights reserved. No part of this repository may be reproduced, distributed, or transmitted in any form without prior written permission from the UFO Dollar team.</p>

<br />
<div align="center">
  <img src="https://forthebadge.com/images/badges/built-with-love.svg" height="28">
  <img src="https://forthebadge.com/images/badges/powered-by-black-magic.svg" height="28">
</div>