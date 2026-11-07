import { useState } from "react";
import { ethers } from "ethers";
import { CONFIG, RULES } from "./config";
import { ERC20_ABI, VAULT_ABI, PRIVACY_POOL_ABI, DISCLOSURE_ABI } from "./abi";

const TABS = ["存入", "保密付款", "赎回", "审计披露", "系统状态"];

export default function App() {
  const [tab, setTab] = useState("存入");
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState("");
  const [msg, setMsg] = useState("");

  async function connect() {
    if (!window.ethereum) return setMsg("请安装 MetaMask 或兼容钱包");
    const _provider = new ethers.BrowserProvider(window.ethereum);
    await _provider.send("eth_requestAccounts", []);
    const _signer = await _provider.getSigner();
    setProvider(_provider);
    setSigner(_signer);
    setAccount(await _signer.getAddress());
    setMsg("");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* 顶部标语 */}
      <header className="border-b border-slate-800 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold tracking-tight">
            企业级保密支付结算网络
          </h1>
          <p className="mt-2 text-slate-400 max-w-3xl">
            用 UFO 完成跨境供应商付款和财库调拨：
            <span className="text-slate-200">单笔金额和对手方对公众隐藏</span>，
            <span className="text-slate-200">系统储备和总供应量公开可查</span>，
            审计与监管在授权下可验证。
          </p>
          <div className="mt-4 flex items-center gap-3">
            {account ? (
              <span className="text-sm text-emerald-400">
                已连接：{account.slice(0, 6)}...{account.slice(-4)}
              </span>
            ) : (
              <button
                onClick={connect}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
              >
                连接钱包
              </button>
            )}
            <span className="text-xs text-slate-500">
              兑换比例：1 UFO = {CONFIG.RATE} USDT
            </span>
          </div>
        </div>
      </header>

      {/* 标签导航 */}
      <nav className="border-b border-slate-800 px-6">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition ${
                tab === t
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {msg && (
          <div className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
            {msg}
          </div>
        )}

        {tab === "存入" && <Deposit signer={signer} setMsg={setMsg} />}
        {tab === "保密付款" && <PrivatePay signer={signer} setMsg={setMsg} />}
        {tab === "赎回" && <Withdraw signer={signer} setMsg={setMsg} />}
        {tab === "审计披露" && <Disclosure signer={signer} setMsg={setMsg} />}
        {tab === "系统状态" && <SystemStatus provider={provider} />}

        {/* 规则区——始终展示，不可折叠隐藏 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="text-lg font-semibold mb-4">产品规则</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {RULES.map((r) => (
              <div key={r.title} className="rounded-lg bg-slate-950/60 p-4">
                <h3 className="text-sm font-medium text-emerald-400">{r.title}</h3>
                <p className="mt-1 text-sm text-slate-400 leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            本产品不是存款、不是投资品、不承诺收益。使用前请阅读完整用户协议与风险披露。
          </p>
        </section>
      </main>
    </div>
  );
}

/* ---------- 存入：approve + deposit ---------- */
function Deposit({ signer, setMsg }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!signer) return setMsg("请先连接钱包");
    try {
      setBusy(true);
      const usdt = new ethers.Contract(CONFIG.USDT, ERC20_ABI, signer);
      const vault = new ethers.Contract(CONFIG.VAULT, VAULT_ABI, signer);
      const raw = ethers.parseUnits(amount, CONFIG.USDT_DECIMALS);
      const allowance = await usdt.allowance(await signer.getAddress(), CONFIG.VAULT);
      if (allowance < raw) {
        const tx = await usdt.approve(CONFIG.VAULT, raw);
        await tx.wait();
      }
      const tx = await vault.deposit(raw);
      await tx.wait();
      setMsg(`成功存入 ${amount} USDT，已铸造 ${Number(amount) / CONFIG.RATE} UFO`);
    } catch (e) {
      setMsg(e?.shortMessage || e?.message || "交易失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="存入 USDT，铸造 UFO" desc="USDT 进入独立多签储备地址，UFO 铸造到你的钱包。储备地址公开可查。">
      <input
        className={inputCls}
        placeholder="USDT 数量（须为 10 的整数倍）"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <p className="text-xs text-slate-500">预计获得：{amount ? Number(amount) / CONFIG.RATE : 0} UFO</p>
      <button disabled={busy} onClick={handle} className={btnCls}>
        {busy ? "处理中..." : "存入并铸造"}
      </button>
    </Section>
  );
}

/* ---------- 保密付款：shield ---------- */
function PrivatePay({ signer, setMsg }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!signer) return setMsg("请先连接钱包");
    try {
      setBusy(true);
      const pool = new ethers.Contract(CONFIG.PRIVACY_POOL, PRIVACY_POOL_ABI, signer);
      // 实际项目中 commitment 由链下用 secret+nullifier+amount+viewKey 计算
      const commitment = ethers.hexlify(ethers.randomBytes(32));
      const raw = ethers.parseUnits(amount, CONFIG.UFO_DECIMALS);
      const tx = await pool.shield(raw, commitment);
      await tx.wait();
      setMsg(`已存入屏蔽池。请妥善保存 commitment：${commitment}`);
    } catch (e) {
      setMsg(e?.shortMessage || e?.message || "交易失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="保密付款（屏蔽池）"
      desc="UFO 进入屏蔽池后，后续收款方、金额对公众不可见。你持有查看密钥，可向审计方选择性披露。"
    >
      <input
        className={inputCls}
        placeholder="UFO 数量"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <p className="text-xs text-slate-500">
        注意：屏蔽的是单笔商业付款细节；UFO 总供应量和储备覆盖率仍然公开。
      </p>
      <button disabled={busy} onClick={handle} className={btnCls}>
        {busy ? "处理中..." : "存入屏蔽池"}
      </button>
    </Section>
  );
}

/* ---------- 赎回：withdraw ---------- */
function Withdraw({ signer, setMsg }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!signer) return setMsg("请先连接钱包");
    try {
      setBusy(true);
      const vault = new ethers.Contract(CONFIG.VAULT, VAULT_ABI, signer);
      const raw = ethers.parseUnits(amount, CONFIG.UFO_DECIMALS);
      const tx = await vault.withdraw(raw);
      await tx.wait();
      setMsg(`已销毁 ${amount} UFO，按规则赎回 ${Number(amount) * CONFIG.RATE} USDT`);
    } catch (e) {
      setMsg(e?.shortMessage || e?.message || "交易失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="赎回 USDT"
      desc="销毁 UFO，从独立储备地址按 1 UFO = 10 USDT 转出。赎回可能受限额、手续费和依法暂停条件约束。"
    >
      <input
        className={inputCls}
        placeholder="UFO 数量"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <p className="text-xs text-slate-500">预计获得：{amount ? Number(amount) * CONFIG.RATE : 0} USDT</p>
      <button disabled={busy} onClick={handle} className={btnCls}>
        {busy ? "处理中..." : "销毁并赎回"}
      </button>
    </Section>
  );
}

/* ---------- 审计披露 ---------- */
function Disclosure({ signer, setMsg }) {
  const [commitment, setCommitment] = useState("");
  const [auditor, setAuditor] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (!signer) return setMsg("请先连接钱包");
    try {
      setBusy(true);
      const dm = new ethers.Contract(CONFIG.DISCLOSURE, DISCLOSURE_ABI, signer);
      // 实际项目中 proofOfViewKey 由链下生成
      const proof = ethers.hexlify(ethers.randomBytes(64));
      const tx = await dm.authorizeDisclosure(commitment, auditor, proof);
      await tx.wait();
      setMsg("已授权该审计方查看指定交易的明文。");
    } catch (e) {
      setMsg(e?.shortMessage || e?.message || "交易失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="选择性披露"
      desc="由企业主动发起，向指定审计方、税务或监管方披露某一笔付款的明细。平台不能单方面查看你的付款记录。"
    >
      <input
        className={inputCls}
        placeholder="Commitment（交易凭证）"
        value={commitment}
        onChange={(e) => setCommitment(e.target.value)}
      />
      <input
        className={inputCls}
        placeholder="审计方地址"
        value={auditor}
        onChange={(e) => setAuditor(e.target.value)}
      />
      <button disabled={busy} onClick={handle} className={btnCls}>
        {busy ? "处理中..." : "授权披露"}
      </button>
    </Section>
  );
}

/* ---------- 系统状态 ---------- */
function SystemStatus({ provider }) {
  const [supply, setSupply] = useState("--");
  const [reserveBal, setReserveBal] = useState("--");

  async function refresh() {
    if (!provider) return;
    const ufo = new ethers.Contract(CONFIG.UFO, ERC20_ABI, provider);
    const usdt = new ethers.Contract(CONFIG.USDT, ERC20_ABI, provider);
    const total = await ufo.totalSupply?.().catch(() => null);
    setSupply(total ? ethers.formatUnits(total, CONFIG.UFO_DECIMALS) : "--");
    const bal = await usdt.balanceOf(CONFIG.RESERVE_ADDRESS);
    setReserveBal(ethers.formatUnits(bal, CONFIG.USDT_DECIMALS));
  }

  const coverage =
    supply !== "--" && reserveBal !== "--" && Number(supply) > 0
      ? ((Number(reserveBal) / (Number(supply) * CONFIG.RATE)) * 100).toFixed(2) + "%"
      : "--";

  return (
    <Section
      title="系统状态（公开可查）"
      desc="这些数据始终公开。保密只作用于单笔付款，不隐藏系统总量和储备。"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="UFO 总供应量" value={supply} />
        <Stat label="储备 USDT 余额" value={reserveBal} />
        <Stat label="储备覆盖率" value={coverage} highlight />
      </div>
      <p className="text-xs text-slate-500 break-all">
        储备地址（多签，公开可查）：{CONFIG.RESERVE_ADDRESS}
      </p>
      <button onClick={refresh} className={btnCls}>刷新数据</button>
    </Section>
  );
}

/* ---------- 通用组件 ---------- */
function Section({ title, desc, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-sm text-slate-400">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-lg bg-slate-950/60 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${highlight ? "text-emerald-400" : ""}`}>
        {value}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-emerald-500";
const btnCls =
  "rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50";