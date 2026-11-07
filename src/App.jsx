import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONFIG, ERC20_ABI, VAULT_ABI, PRIVACY_POOL_ABI, DISCLOSURE_ABI } from "./contracts";

// 导航标签
const TABS = [
  { id: "deposit", label: "存入铸币" },
  { id: "pay", label: "保密付款" },
  { id: "withdraw", label: "赎回结算" },
  { id: "disclose", label: "审计披露" },
  { id: "status", label: "系统状态" },
];

export default function App() {
  const [tab, setTab] = useState("deposit");
  const [account, setAccount] = useState("");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // 连接钱包
  async function connectWallet() {
    if (!window.ethereum) return showMsg("error", "请安装 MetaMask 或兼容钱包");
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await _provider.send("eth_requestAccounts", []);
      const _signer = await _provider.getSigner();
      setProvider(_provider);
      setSigner(_signer);
      setAccount(accounts[0]);
      showMsg("success", "钱包已连接");
    } catch (err) {
      showMsg("error", "连接失败: " + err.message);
    }
  }

  const showMsg = (type, text) => setMsg({ type, text });

  return (
    <div className="min-h-screen flex flex-col md:flex-row text-slate-200">
      {/* 侧边栏 / 导航 */}
      <aside className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-emerald-500 text-2xl">🛸</span> UFO 结算网络
          </h1>
          <p className="text-xs text-slate-500 mt-1">企业级保密支付工具</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setMsg({ type: "", text: "" }); }}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                tab === t.id
                  ? "bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-2">
          <p>⚠️ 提示：本产品为支付工具，非存款/理财产品。储备地址公开可查，赎回受限额及合规约束。</p>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col">
        {/* 顶栏 */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
          <div className="text-sm text-slate-400">
            网络：BNB Smart Chain | 兑换比例：<span className="text-emerald-400">1 UFO = {CONFIG.RATE} USDT</span>
          </div>
          {account ? (
            <div className="bg-slate-800 px-4 py-1.5 rounded-full text-sm font-mono border border-slate-700">
              {account.slice(0, 6)}...{account.slice(-4)}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-6 py-2 rounded-lg transition-colors"
            >
              连接钱包
            </button>
          )}
        </header>

        {/* 消息提示 */}
        <div className="px-8 pt-6">
          {msg.text && (
            <div className={`p-4 rounded-lg text-sm border ${
              msg.type === "error" 
                ? "bg-red-950/50 border-red-900 text-red-400" 
                : "bg-emerald-950/50 border-emerald-900 text-emerald-400"
            }`}>
              {msg.text}
            </div>
          )}
        </div>

        {/* 内容路由 */}
        <div className="p-8 max-w-4xl w-full mx-auto">
          {tab === "deposit" && <DepositPanel signer={signer} showMsg={showMsg} />}
          {tab === "pay" && <PayPanel signer={signer} showMsg={showMsg} />}
          {tab === "withdraw" && <WithdrawPanel signer={signer} showMsg={showMsg} />}
          {tab === "disclose" && <DisclosurePanel signer={signer} showMsg={showMsg} />}
          {tab === "status" && <StatusPanel provider={provider} />}
        </div>
      </main>
    </div>
  );
}

/* ================= 子组件 ================= */

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
      
      // 1. Approve
      const allowance = await usdt.allowance(address, CONFIG.VAULT);
      if (allowance < rawAmount) {
        showMsg("success", "正在授权 USDT...");
        const txApprove = await usdt.approve(CONFIG.VAULT, ethers.MaxUint256);
        await txApprove.wait();
      }
      
      // 2. Deposit
      showMsg("success", "正在存入并铸造 UFO...");
      const tx = await vault.deposit(rawAmount);
      await tx.wait();
      
      showMsg("success", `成功存入 ${amount} USDT，已按比例铸造 UFO。`);
      setAmount("");
    } catch (err) {
      showMsg("error", err.shortMessage || "交易失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-medium mb-1">存入 USDT 铸造 UFO</h2>
      <p className="text-sm text-slate-400 mb-6">USDT 将进入独立的多签储备地址。铸造的 UFO 将发送至您的钱包，用于后续保密支付。</p>
      
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
        <div className="text-sm text-slate-500 mb-2">存入金额</div>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-3xl font-mono text-white outline-none flex-1 w-full"
          />
          <span className="text-slate-400 font-medium">USDT</span>
        </div>
      </div>

      <div className="flex justify-between text-sm text-slate-400 mb-6 px-2">
        <span>预计获得</span>
        <span className="text-emerald-400 font-mono">{amount ? Number(amount) / CONFIG.RATE : 0} UFO</span>
      </div>

      <button
        onClick={handleDeposit}
        disabled={loading}
        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold py-4 rounded-xl transition-all"
      >
        {loading ? "处理中..." : "确认存入并铸造"}
      </button>
    </div>
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
      
      // 实际项目中，commitment 由业务层用 secret+nullifier 生成
      const commitment = ethers.hexlify(ethers.randomBytes(32));
      
      showMsg("success", "正在将 UFO 转入屏蔽池...");
      const tx = await pool.shield(rawAmount, commitment);
      await tx.wait();
      
      showMsg("success", `成功存入屏蔽池。凭证（Commitment）：${commitment}。请妥善保存用于后续审计披露。`);
      setAmount("");
    } catch (err) {
      showMsg("error", err.shortMessage || "交易失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-medium mb-1">保密付款（进入屏蔽池）</h2>
      <p className="text-sm text-slate-400 mb-6">UFO 进入屏蔽池后，付款金额与收款地址将对公众隐藏，切断链上追踪。仅授权审计方可查看明细。</p>
      
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
        <div className="text-sm text-slate-500 mb-2">支付金额</div>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-3xl font-mono text-white outline-none flex-1 w-full"
          />
          <span className="text-slate-400 font-medium">UFO</span>
        </div>
      </div>

      <button
        onClick={handleShield}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all"
      >
        {loading ? "处理中..." : "确认并进入屏蔽池"}
      </button>
    </div>
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
      showMsg("error", err.shortMessage || "交易失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-medium mb-1">赎回结算</h2>
      <p className="text-sm text-slate-400 mb-6">销毁 UFO，从独立储备地址按固定比例提取 USDT。赎回行为将公开记录在链上。</p>
      
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
        <div className="text-sm text-slate-500 mb-2">赎回数量</div>
        <div className="flex items-center gap-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-3xl font-mono text-white outline-none flex-1 w-full"
          />
          <span className="text-slate-400 font-medium">UFO</span>
        </div>
      </div>

      <div className="flex justify-between text-sm text-slate-400 mb-6 px-2">
        <span>预计收到</span>
        <span className="text-emerald-400 font-mono">{amount ? Number(amount) * CONFIG.RATE : 0} USDT</span>
      </div>

      <button
        onClick={handleWithdraw}
        disabled={loading}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all"
      >
        {loading ? "处理中..." : "确认赎回 USDT"}
      </button>
    </div>
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
      const proof = ethers.hexlify(ethers.randomBytes(64)); // 模拟 ZK 证明
      
      showMsg("success", "正在授权审计方查看...");
      const tx = await dm.authorizeDisclosure(commitment, auditor, proof);
      await tx.wait();
      
      showMsg("success", "已成功授权该地址查看指定交易的明细。");
    } catch (err) {
      showMsg("error", err.shortMessage || "交易失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <h2 className="text-lg font-medium mb-1">选择性披露</h2>
      <p className="text-sm text-slate-400 mb-6">由企业主动发起，向指定的审计方或监管机构披露某一笔保密付款的金额和对手方。</p>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm text-slate-400 mb-1 block">交易凭证（Commitment）</label>
          <input
            type="text"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder="0x..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 font-mono text-sm"
          />
        </div>
        <div>
          <label className="text-sm text-slate-400 mb-1 block">审计方地址</label>
          <input
            type="text"
            value={auditor}
            onChange={(e) => setAuditor(e.target.value)}
            placeholder="0x..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500 font-mono text-sm"
          />
        </div>
      </div>

      <button
        onClick={handleDisclose}
        disabled={loading}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all"
      >
        {loading ? "处理中..." : "授权披露明细"}
      </button>
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
      if (Number(supplyStr) > 0) {
        cov = ((Number(reserveStr) / (Number(supplyStr) * CONFIG.RATE)) * 100).toFixed(2) + "%";
      } else if (totalSupply === 0n) {
        cov = "100%";
      }

      setData({ supply: supplyStr, reserve: reserveStr, coverage: cov });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (provider) fetchData();
  }, [provider]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-medium mb-1">系统状态（公开可查）</h2>
          <p className="text-sm text-slate-400">保密只作用于单笔付款，系统总量与储备始终公开。</p>
        </div>
        <button onClick={fetchData} className="text-sm text-blue-400 hover:text-blue-300">
          {loading ? "刷新中..." : "刷新数据"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
          <div className="text-sm text-slate-500 mb-1">UFO 总供应量</div>
          <div className="text-2xl font-mono text-white">{data.supply}</div>
        </div>
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
          <div className="text-sm text-slate-500 mb-1">储备 USDT 余额</div>
          <div className="text-2xl font-mono text-white">{data.reserve}</div>
        </div>
        <div className="bg-slate-950 p-5 rounded-xl border border-emerald-900/50">
          <div className="text-sm text-emerald-600 mb-1">储备覆盖率</div>
          <div className="text-2xl font-mono text-emerald-400">{data.coverage}</div>
        </div>
      </div>

      <div className="mt-6 p-4 bg-slate-950 rounded-xl border border-slate-800">
        <div className="text-sm text-slate-500 mb-1">官方多签储备地址</div>
        <div className="font-mono text-sm text-slate-300 break-all">{CONFIG.RESERVE_ADDRESS}</div>
      </div>
    </div>
  );
}