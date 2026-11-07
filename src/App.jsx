import React, { useState, useEffect } from "react";
import { ethers } from "ethers";

// ==========================================
// 1. 配置与常量
// ==========================================
const CONFIG = {
  CHAIN_ID: 56,
  USDT: "0x55d398326f99059fF775485246999027B3197955",
  UFO: "0x0000000000000000000000000000000000000000",
  VAULT: "0x0000000000000000000000000000000000000000",
  PRIVACY_POOL: "0x0000000000000000000000000000000000000000",
  DISCLOSURE: "0x0000000000000000000000000000000000000000",
  RESERVE_ADDRESS: "0x0000000000000000000000000000000000000000",
  RATE: 10,
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];
const VAULT_ABI = ["function deposit(uint256 usdtAmount)", "function withdraw(uint256 ufoAmount)"];
const PRIVACY_POOL_ABI = ["function shield(uint256 amount, bytes32 commitment)"];
const DISCLOSURE_ABI = ["function authorizeDisclosure(bytes32 commitment, address auditor, bytes proofOfViewKey)"];

const TABS = [
  { id: "deposit", label: "存入铸币", icon: "📥" },
  { id: "pay", label: "保密付款", icon: "🕶️" },
  { id: "withdraw", label: "赎回结算", icon: "💸" },
  { id: "disclose", label: "审计披露", icon: "📄" },
  { id: "kyb", label: "企业准入 (KYB)", icon: "🛡️" },
  { id: "status", label: "系统状态", icon: "📊" },
];

// 主流钱包配置
const WALLETS = [
  { id: "metamask", name: "MetaMask", icon: "🦊", desc: "全球最广泛使用的钱包", url: "https://metamask.app.link/dapp/" },
  { id: "trust", name: "Trust Wallet", icon: "🛡️", desc: "币安官方推荐钱包", url: "https://link.trustwallet.com/open_url?coin_id=60&url=" },
  { id: "binance", name: "Binance Wallet", icon: "🟡", desc: "币安 Web3 钱包", url: "https://app.binance.com/en/download" },
  { id: "okx", name: "OKX Web3", icon: "⭕", desc: "欧易 Web3 钱包", url: "okx://wallet/dapp/details?dappUrl=" }
];

export default function App() {
  const [tab, setTab] = useState("deposit");
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });
  
  // 控制弹窗的显示
  const [showWalletModal, setShowWalletModal] = useState(false);

  // 核心连接逻辑
  async function connectWallet(walletId) {
    if (window.ethereum) {
      // 如果是在电脑浏览器，或者已经在钱包App的内置浏览器中
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await _provider.send("eth_requestAccounts", []);
        const _signer = await _provider.getSigner();
        setProvider(_provider);
        setSigner(_signer);
        setAccount(accounts[0]);
        showMsg("success", "钱包已成功连接");
        setShowWalletModal(false);
      } catch (err) {
        showMsg("error", "连接失败: " + (err.shortMessage || err.message));
      }
    } else {
      // 如果是在手机普通浏览器中，没有 window.ethereum，执行深度链接跳转
      if (walletId && walletId !== "binance") {
        const wallet = WALLETS.find(w => w.id === walletId);
        const currentUrl = window.location.href;
        window.location.href = wallet.url + encodeURIComponent(currentUrl);
      } else {
        showMsg("error", "请复制当前网址，前往钱包 App 的内置浏览器中打开。");
        setShowWalletModal(false);
      }
    }
  }

  const showMsg = (type, text) => setMsg({ type, text });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 text-slate-200 font-sans relative">
      
      {/* --- 多钱包选择弹窗 --- */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">连接钱包</h3>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-4 space-y-2">
              <p className="text-sm text-slate-400 mb-4 px-2">请选择你的钱包。如果使用手机，将自动跳转到钱包 App。</p>
              {WALLETS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => connectWallet(w.id)}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-xl shadow-inner">
                    {w.icon}
                  </div>
                  <div className="text-left">
                    <div className="text-white font-medium">{w.name}</div>
                    <div className="text-xs text-slate-500">{w.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/50">
              <p className="text-xs text-slate-500 text-center">连接即表示同意《UFO 服务条款》与《风险提示》</p>
            </div>
          </div>
        </div>
      )}

      {/* 侧边栏 */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-2xl">🛸</div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">UFO Dollar</h1>
            <p className="text-xs text-emerald-500">企业级保密支付</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMsg({ type: "", text: "" }); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm ${
                tab === t.id
                  ? "bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-5 border-t border-slate-800">
          <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 text-xs text-slate-500 leading-relaxed">
            <span className="text-amber-500 font-bold">⚠️ 风险提示：</span>
            本系统为 B2B 支付工具。非理财产品，不承诺收益。业务仅限通过 KYB 审核的白名单企业使用。
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-sm shrink-0">
          <div className="text-sm text-slate-400 hidden md:flex items-center gap-4">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              BNB Smart Chain
            </span>
            <span className="text-slate-600">|</span>
            <span>兑换比例：<strong className="text-emerald-400">1 UFO = {CONFIG.RATE} USDT</strong></span>
          </div>
          
          {account ? (
            <div className="bg-slate-800 px-4 py-1.5 rounded-full text-sm font-mono border border-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-6 py-2 rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
            >
              连接钱包
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {msg.text && (
              <div className={`p-4 rounded-xl text-sm border flex items-start gap-3 ${
                msg.type === "error" ? "bg-red-950/50 border-red-900 text-red-400" : "bg-emerald-950/50 border-emerald-900 text-emerald-400"
              }`}>
                <span>{msg.type === "error" ? "❌" : "✅"}</span>
                <p className="break-all">{msg.text}</p>
              </div>
            )}
            {tab === "deposit" && <DepositPanel signer={signer} showMsg={showMsg} />}
            {tab === "pay" && <PayPanel signer={signer} showMsg={showMsg} />}
            {tab === "withdraw" && <WithdrawPanel signer={signer} showMsg={showMsg} />}
            {tab === "disclose" && <DisclosurePanel signer={signer} showMsg={showMsg} />}
            {tab === "kyb" && <KYBPanel />}
            {tab === "status" && <StatusPanel provider={provider} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// ==========================================
// 子组件与 UI (保持原样)
// ==========================================
function DepositPanel({ signer, showMsg }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    if (!signer) return showMsg("error", "请先连接钱包");
    if (!amount || amount <= 0) return showMsg("error", "请输入有效金额");
    try {
      setLoading(true);
      const usdt = new ethers.Contract(CONFIG.USDT, ERC20_ABI, signer);
      const vault = new ethers.Contract(CONFIG.VAULT, VAULT_ABI, signer);
      const rawAmount = ethers.parseUnits(amount, 6);
      const address = await signer.getAddress();
      
      const allowance = await usdt.allowance(address, CONFIG.VAULT);
      if (allowance < rawAmount) {
        showMsg("success", "正在授权 USDT...");
        const txApprove = await usdt.approve(CONFIG.VAULT, ethers.MaxUint256);
        await txApprove.wait();
      }
      showMsg("success", "正在存入并铸造 UFO...");
      const tx = await vault.deposit(rawAmount);
      await tx.wait();
      showMsg("success", `成功存入 ${amount} USDT，已铸造对应的 UFO 到您的钱包。`);
      setAmount("");
    } catch (err) {
      showMsg("error", err.shortMessage || err.message || "交易失败");
    } finally { setLoading(false); }
  };

  return (
    <PanelCard title="存入 USDT 铸造 UFO" desc="USDT 将进入透明且隔离的多签储备地址。铸造的 UFO 仅用于本网络内的保密支付。">
      <InputBox label="存入金额" value={amount} onChange={setAmount} symbol="USDT" />
      <div className="flex justify-between text-sm text-slate-400 mb-6 px-2">
        <span>预计获得</span>
        <span className="text-emerald-400 font-mono font-bold">{amount ? Number(amount) / CONFIG.RATE : 0} UFO</span>
      </div>
      <ActionButton onClick={handleDeposit} loading={loading} text="确认存入并铸造" />
    </PanelCard>
  );
}

function PayPanel({ signer, showMsg }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const handleShield = async () => {
    if (!signer) return showMsg("error", "请先连接钱包");
    try {
      setLoading(true);
      const pool = new ethers.Contract(CONFIG.PRIVACY_POOL, PRIVACY_POOL_ABI, signer);
      const rawAmount = ethers.parseUnits(amount, 6);
      const commitment = ethers.hexlify(ethers.randomBytes(32));
      showMsg("success", "正在将 UFO 转入屏蔽池...");
      const tx = await pool.shield(rawAmount, commitment);
      await tx.wait();
      showMsg("success", `已进入屏蔽池。交易凭证：${commitment}。请妥善保管。`);
      setAmount("");
    } catch (err) {
      showMsg("error", err.shortMessage || err.message || "交易失败");
    } finally { setLoading(false); }
  };
  return (
    <PanelCard title="保密付款 (屏蔽池)" desc="资金进入屏蔽池后，链上观察者无法追踪资金去向和具体金额。确保商业机密不外泄。">
      <InputBox label="支付金额" value={amount} onChange={setAmount} symbol="UFO" />
      <div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-800">
        <p className="text-xs text-slate-500 leading-relaxed">🛡️ <strong className="text-slate-300">隐私保证：</strong> 只有通过 KYB 白名单的企业才能使用此功能。ZK 技术将隐藏你的转账记录。</p>
      </div>
      <ActionButton onClick={handleShield} loading={loading} text="确认进入屏蔽池" color="blue" />
    </PanelCard>
  );
}

function WithdrawPanel({ signer, showMsg }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const handleWithdraw = async () => {
    if (!signer) return showMsg("error", "请先连接钱包");
    try {
      setLoading(true);
      const vault = new ethers.Contract(CONFIG.VAULT, VAULT_ABI, signer);
      const rawAmount = ethers.parseUnits(amount, 6);
      showMsg("success", "正在销毁 UFO 并赎回 USDT...");
      const tx = await vault.withdraw(rawAmount);
      await tx.wait();
      showMsg("success", `成功赎回 ${Number(amount) * CONFIG.RATE} USDT 到您的钱包。`);
      setAmount("");
    } catch (err) {
      showMsg("error", err.shortMessage || err.message || "交易失败");
    } finally { setLoading(false); }
  };
  return (
    <PanelCard title="赎回结算" desc="销毁 UFO，从隔离的储备地址中提取 USDT。赎回行为受合规审查约束。">
      <InputBox label="赎回数量" value={amount} onChange={setAmount} symbol="UFO" />
      <div className="flex justify-between text-sm text-slate-400 mb-6 px-2">
        <span>预计收到</span>
        <span className="text-emerald-400 font-mono font-bold">{amount ? Number(amount) * CONFIG.RATE : 0} USDT</span>
      </div>
      <ActionButton onClick={handleWithdraw} loading={loading} text="确认销毁并赎回" color="slate" />
    </PanelCard>
  );
}

function DisclosurePanel({ signer, showMsg }) {
  const [commitment, setCommitment] = useState("");
  const [auditor, setAuditor] = useState("");
  const [loading, setLoading] = useState(false);
  const handleDisclose = async () => {
    if (!signer) return showMsg("error", "请先连接钱包");
    try {
      setLoading(true);
      const dm = new ethers.Contract(CONFIG.DISCLOSURE, DISCLOSURE_ABI, signer);
      const proof = ethers.hexlify(ethers.randomBytes(64));
      showMsg("success", "正在授权审计方...");
      const tx = await dm.authorizeDisclosure(commitment, auditor, proof);
      await tx.wait();
      showMsg("success", "已成功授权该地址查看指定交易的明细，其他公众依然不可见。");
    } catch (err) {
      showMsg("error", err.shortMessage || err.message || "交易失败");
    } finally { setLoading(false); }
  };
  return (
    <PanelCard title="选择性披露" desc="企业主动向税务、审计或监管方披露特定保密交易的细节。">
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">交易凭证 (Commitment)</label>
          <input type="text" value={commitment} onChange={(e) => setCommitment(e.target.value)} placeholder="0x..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 font-mono text-sm" />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-2 block">审计方地址</label>
          <input type="text" value={auditor} onChange={(e) => setAuditor(e.target.value)} placeholder="0x..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 font-mono text-sm" />
        </div>
      </div>
      <ActionButton onClick={handleDisclose} loading={loading} text="授权披露明细" color="slate" />
    </PanelCard>
  );
}

function KYBPanel() {
  const steps = [
    { title: "主体与实控人穿透", desc: "核查企业注册证书、股权结构、最终受益人（UBO），确保交易主体真实。" },
    { title: "业务真实性验证", desc: "要求提供商业合同、发票等，确认资金背景具备真实贸易支撑，拒绝空壳。" },
    { title: "链上地址风控筛查", desc: "使用 Chainalysis 等工具排查企业地址，隔绝暗网、黑客及受制裁资金。" },
    { title: "白名单链上授权", desc: "审查通过后，地址写入智能合约白名单，方可使用保密支付功能。" }
  ];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-2">企业安全准入 (KYB)</h2>
      <p className="text-sm text-slate-400 mb-8 max-w-2xl leading-relaxed">
        UFO 网络是一个“许可型隐私网络”。为了保证屏蔽池内的绝对干净，防止黑钱污染，我们不向公众开放。只有通过严格 KYB 审查的真实企业，才能进入这个安全、保密的结算网络。
      </p>
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {steps.map((step, idx) => (
          <div key={idx} className="bg-slate-950 border border-slate-800 p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">{idx + 1}</span>
              <h3 className="text-white font-medium">{step.title}</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
      <button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-emerald-500/20">联系商务提交 KYB 申请</button>
    </div>
  );
}

function StatusPanel({ provider }) {
  const [data, setData] = useState({ supply: "--", reserve: "--", coverage: "--" });
  const [loading, setLoading] = useState(false);
  const fetchData = async () => {
    if (!provider) return;
    try {
      setLoading(true);
      const ufo = new ethers.Contract(CONFIG.UFO, ERC20_ABI, provider);
      const usdt = new ethers.Contract(CONFIG.USDT, ERC20_ABI, provider);
      const [totalSupply, reserveBal] = await Promise.all([
        ufo.totalSupply().catch(() => 0n),
        usdt.balanceOf(CONFIG.RESERVE_ADDRESS).catch(() => 0n)
      ]);
      const supplyStr = ethers.formatUnits(totalSupply, 6);
      const reserveStr = ethers.formatUnits(reserveBal, 6);
      let cov = "--";
      if (Number(supplyStr) > 0) cov = ((Number(reserveStr) / (Number(supplyStr) * CONFIG.RATE)) * 100).toFixed(2) + "%";
      else if (totalSupply === 0n) cov = "100%";
      setData({ supply: supplyStr, reserve: reserveStr, coverage: cov });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };
  useEffect(() => { if (provider) fetchData(); }, [provider]);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">系统状态 (公开透明)</h2>
          <p className="text-sm text-slate-400">商业付款保密，但系统总量与储备对公众完全透明，随时可查。</p>
        </div>
        <button onClick={fetchData} className="text-sm bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-emerald-400 transition-colors">{loading ? "刷新中..." : "刷新数据"}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800"><div className="text-sm text-slate-500 mb-2">UFO 总供应量</div><div className="text-3xl font-mono text-white">{data.supply}</div></div>
        <div className="bg-slate-950 p-6 rounded-xl border border-slate-800"><div className="text-sm text-slate-500 mb-2">储备 USDT 余额</div><div className="text-3xl font-mono text-white">{data.reserve}</div></div>
        <div className="bg-slate-950 p-6 rounded-xl border border-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]"><div className="text-sm text-emerald-600 mb-2">储备覆盖率</div><div className="text-3xl font-mono text-emerald-400 font-bold">{data.coverage}</div></div>
      </div>
      <div className="bg-slate-950 p-6 rounded-xl border border-slate-800">
        <div className="text-sm text-slate-500 mb-2">官方多签储备地址 (Safe)</div>
        <div className="font-mono text-base text-blue-400 break-all">{CONFIG.RESERVE_ADDRESS}</div>
      </div>
    </div>
  );
}

function PanelCard({ title, desc, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-sm text-slate-400 mb-8">{desc}</p>
      {children}
    </div>
  );
}

function InputBox({ label, value, onChange, symbol }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-4">
      <div className="text-sm text-slate-500 mb-2">{label}</div>
      <div className="flex items-center gap-4">
        <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0.00" className="bg-transparent text-4xl font-mono text-white outline-none flex-1 w-full placeholder-slate-700" />
        <span className="text-slate-400 font-bold text-lg">{symbol}</span>
      </div>
    </div>
  );
}

function ActionButton({ onClick, loading, text, color = "emerald" }) {
  const bgClass = color === "emerald" ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20" : color === "blue" ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20" : "bg-slate-700 hover:bg-slate-600 text-white shadow-slate-700/20";
  return (
    <button onClick={onClick} disabled={loading} className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${bgClass}`}>
      {loading ? "区块链确认中..." : text}
    </button>
  );
}