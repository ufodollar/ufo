<div align="center">
  <h1>🛸 UFO Dollar - Frontend DApp</h1>
  <p><strong>The Web Interface for Asset Concealment and Private Settlement.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Status-Production--Ready-success?style=for-the-badge&logo=checkmarx" alt="Status">
    <img src="https://img.shields.io/badge/Framework-React_Vite-61DAFB?style=for-the-badge&logo=react" alt="React">
    <img src="https://img.shields.io/badge/Web3-Ethers.js_v6-3C3C3D?style=for-the-badge&logo=ethereum" alt="Ethers">
    <img src="https://img.shields.io/badge/Wallet-EIP--1193-black?style=for-the-badge&logo=ethereum" alt="EIP-1193">
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

<h2>⚡ 连接架构（没有钱包 SDK，也没有中继服务器）</h2>
<p>页面不依赖 AppKit、WalletConnect 或任何钱包 SDK。连接只有一条路径：<b>EIP-1193 注入</b>。</p>
<table>
  <tr><th>场景</th><th>怎么连上</th><th>下载量</th></tr>
  <tr><td>钱包 App 内置浏览器（授权过）</td><td>页面里已有 <code>window.ethereum</code>，<code>eth_accounts</code> 静默恢复，零点击</td><td>0</td></tr>
  <tr><td>钱包 App 内置浏览器（首次）</td><td>落地地址带 <code>?c=1</code>，页面自动发起授权，钱包弹自己的确认框，点一次即完成</td><td>0</td></tr>
  <tr><td>桌面装了扩展</td><td>EIP-6963 发现，点一下直连；多个扩展时让用户自己选</td><td>0</td></tr>
  <tr><td>手机普通浏览器</td><td>点钱包图标 → universal link / scheme 跳进该 App 的内置浏览器 → 回到第一条</td><td>0</td></tr>
  <tr><td>桌面什么钱包都没有</td><td>显示二维码，手机扫码后在手机上下载的流程里完成</td><td>0</td></tr>
</table>
<p>这意味着任何网络环境下都能连上：没有 <code>relay.walletconnect.org</code> 可连，就没有连不上的理由。</p>

<h3>落地即连接：把「进入 → 点按钮 → 点确认」压成「点确认」</h3>
<p>钱包内置浏览器打开一个<b>从未授权过</b>的站点时，<code>eth_accounts</code> 一定返回空数组 —— 这是钱包的安全模型，网页绕不过去。所以钱包图标的跳转目标都带 <code>?c=1</code>，页面一读到它就发起 <code>eth_requestAccounts</code>，直接弹出钱包自己的授权框，用户点一次「连接」即可，不必先去页面上找按钮。</p>
<p>授权成功后写入 <code>localStorage.ufo_linked</code>。此后无论从哪个入口进来（包括直接输入网址），都是零点击秒连；即使中途被撤销过授权，也会自动补弹一次，而不是干等着用户发现。</p>
<p>不做无条件自动请求：普通浏览器打开本站（地址没有 <code>?c=1</code> 且 <code>ufo_linked</code> 为空）只发 <code>eth_accounts</code>，不弹任何窗口 —— 不能为了连接体验赶走「只想看汇率」的访客。</p>
<p><b>为什么 Trust Wallet 看起来是秒连：</b>它对内置浏览器里的 dapp 更宽松，<code>eth_accounts</code> 会直接放行。MetaMask 不会。这是各钱包自己的策略差异，不是网页能做到的事。</p>
<table>
  <tr><th>模块</th><th>何时加载</th><th>大小（min / gzip）</th></tr>
  <tr><td>React + UI + 读链层 + 钱包层</td><td>首屏必需</td><td>≈204KB / 64KB</td></tr>
  <tr><td>Ethers.js</td><td>第一次签交易前（输入金额时即预取）</td><td>≈214KB / 82KB</td></tr>
</table>
<p>五个设计决定值得记住，改代码时不要退回去：</p>
<ol>
  <li><b>读链不用 ethers。</b> 所有读取都是 <code>eth_call</code>，参数只有 <code>address</code> / <code>uint256</code>，<code>src/chain.js</code> 手写编码，省下 270KB。</li>
  <li><b>不引入钱包 SDK。</b> AppKit 一家 1.5MB，且强制依赖 Relay。用户要的只是「点一下进钱包」，用系统 universal link 就够。</li>
  <li><b>自定义 scheme 必须设超时回落。</b> 没装 App 时浏览器不会有任何回调，1.8 秒后跳下载页，否则用户会以为按钮坏了。</li>
  <li><b>钱包图标本地打包。</b> 走 App Store 原图转 webp，10 个共 16KB，不依赖任何图床（国内访问 coingecko 会超时）。</li>
  <li><b>自动请求授权要有条件。</b> 只有「带 <code>?c=1</code> 落地」或「这个浏览器连过」才主动弹窗，其余情况静默等待。无条件弹窗等于用打扰换转化。</li>
</ol>

<h2>🚀 Local Development</h2>
<blockquote>
  <p>💡 <b>Developer Note:</b> Use Node.js v18 or higher. No API keys or project IDs are required.</p>
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