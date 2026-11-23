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

<h2>👛 钱包架构（钱包就在页面里，没有 SDK，没有中继）</h2>
<p>UFO 的钱包不是「连接」来的，而是<b>在这一页里生成</b>的。用户第一次打开站点，点右上角 <b>Create Wallet</b>，页面当场生成一把随机<b>私钥</b>与对应地址，不需要安装任何 App，也不经过任何第三方服务。手上已有私钥的人可以走右上角的账户管理（滑块图标）→ <b>Import private key</b> 直接导入，同一个 PIN 下可以挂多个账户并随时切换。</p>
<p>页面本身<b>不显示任何地址</b>：顶部只有「Account 1 / Account 2」这样的序号，地址、查看私钥、删除账户、切换账户全部收在账户管理弹窗里。链上明细的入口在 History 页右上角的 BscScan 按钮。</p>
<table>
  <tr><th>状态</th><th>界面</th><th>能做什么</th></tr>
  <tr><td>还没有钱包</td><td>顶部 Create Wallet ＋ 账户管理按钮</td><td>生成新地址（每次都是新的随机私钥），或导入已有私钥</td></tr>
  <tr><td>已生成，本次会话未解锁</td><td>顶部 Unlock / 锁图标 / 账户管理</td><td>输 6 位 PIN 解密私钥；进账户管理需先过 PIN</td></tr>
  <tr><td>已解锁</td><td>顶部 Account N ＋ 锁图标 ＋ 账户管理</td><td>发行 UFO、销毁 UFO、查看余额；Wallet 页只有资产列表</td></tr>
</table>

<h3>密钥怎么存</h3>
<p>私钥用用户设置的 6 位 PIN 加密：<b>PBKDF2-SHA256（210,000 轮）</b>派生一把 vault 密钥，<b>AES-GCM</b> 逐账户加密，密文与盐、IV 一起写进 <code>localStorage['ufo.local.wallet.v1']</code>。解出来的私钥只存在内存里，刷新即失效，所以每次重新打开页面都要输一次 PIN。</p>
<p>生成后弹窗完整展示地址与私钥，<b>可以直接复制</b>——用户必须能把它带走。关掉之后想再看，走 <b>View private key</b>，<b>每次都要重新输 6 位 PIN</b>，就算钱包当前已解锁也一样：解锁是持续状态，看私钥是一次性动作。没复制过的人，Wallet 卡片上会留一条提醒。</p>
<p>账户模型是一个 PIN 一个 vault、vault 里挂 N 个账户。切账户用内存里的 vault 密钥解对应那条密文，不用重复输 PIN；新增账户同样不需要（已解锁时）。旧版本（v1，存助记词）的记录会在第一次解锁时自动迁移成私钥版，地址不变。</p>
<p>账户管理弹窗里每个账户都列出完整地址，并带 <b>View private key</b>（每次要重输 PIN）与 <b>Delete</b>（二次确认）两个按钮。删除只删本机的密文，链上资产不动；删掉最后一个账户等于删掉整个钱包，页面回到 Create Wallet。切账户后所有读写都跟着走：余额用新地址重新读，签名前还会校验 <code>tx.from</code> 与当前账户是否一致，不一致直接拒签，避免「用 A 的余额签 B 的交易」。</p>

<h3>签名怎么发生</h3>
<p>本地钱包实现成一个 EIP-1193 provider（<code>src/localwallet.js</code>）：<code>eth_sendTransaction</code> 收到的是 <code>tx.js</code> 已经算好 nonce / gas / gasPrice 的交易，钱包只负责签名并广播原始字节。因此余额刷新、nonce 管理、回执轮询、错误处理全部沿用原有逻辑，没有为「本地钱包」写第二套。</p>

<h3>为什么不做钱包墙</h3>
<p>移动端网页做不到「把 App 叫起来、但确认框仍渲染在网页里」：私钥在 App 里，确认界面就必须由 App 渲染；而任何网页能渲染的确认框都可以被钓鱼页伪造。<b>要让确认框出现在页面里，私钥就必须也在页面里。</b>这条限制不是实现问题，是浏览器的安全边界。</p>
<p>同理，WalletConnect 这类协议需要一个双方都能连上的中继；中继在部分网络里建不起长连接，而钱包 App 侧的中继地址是写死的，网页无法替换。把入口留在这里，只会变成「点了没反应」。</p>
<table>
  <tr><th>模块</th><th>何时加载</th><th>大小（min / gzip）</th></tr>
  <tr><td>React + UI + 读链层 + 钱包层</td><td>首屏必需</td><td>≈225KB / 71KB</td></tr>
  <tr><td>Ethers.js</td><td>第一次生成钱包或签交易前</td><td>≈210KB / 78KB</td></tr>
</table>
<p>四个设计决定值得记住，改代码时不要退回去：</p>
<ol>
  <li><b>读链不用 ethers。</b> 所有读取都是 <code>eth_call</code>，参数只有 <code>address</code> / <code>uint256</code>，<code>src/chain.js</code> 手写编码，省下 270KB。</li>
  <li><b>不引入钱包 SDK。</b> 本地钱包只需要 <code>ethers</code> 的 <code>Wallet</code> 与 <code>TypedDataEncoder</code>，按需动态加载，首屏为 0。</li>
  <li><b>密钥永不明文落盘。</b> 只存 AES-GCM 密文；查看私钥必须重新输 PIN，且不从内存里取已解密的密钥。</li>
  <li><b>地址由私钥推导，不是另生成的随机串。</b> 写入前会用 <code>new Wallet(privateKey).address</code> 复核一次，不一致直接拒绝落盘 —— 否则用户会把钱打进一个没有对应私钥的地址。</li>
  <li><b>私钥只在两处出现。</b> 生成后的一次展示（可复制，用户要带走），与 View private key 的验证后展示。</li>
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