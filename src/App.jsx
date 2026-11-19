import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import { BrowserProvider, Contract, formatUnits, parseUnits, MaxUint256 } from 'ethers';
import RulesTab from './components/RulesTab.jsx';

/* ============================================================
   ⚙️ CONFIG — 与 README 完全一致
   ============================================================ */
const CONFIG = {
  VAULT_ADDRESS: '0xa8A312b008F3EE819C535EB3cAD754B2e5B8b3a2',
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  FEE_RATE: 0.005, // 0.5% Settlement Fee
};

/* Reown AppKit 项目 ID —— 部署前请替换为自己的 projectId */
const PROJECT_ID = 'YOUR_REOWN_PROJECT_ID';

/* ============================================================
   📜 ABIs — 仅包含必要方法
   ============================================================ */
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

/* 若 Vault 实际方法名不同（如 buyWithUSDT / sellForUSDT），
   只需替换下面字符串，其余代码无需改动 */
const VAULT_ABI = [
  'function mint(address token, uint256 amount) returns (uint256)',
  'function redeem(address token, uint256 amount) returns (uint256)',
  'function paused() view returns (bool)',
];

/* ============================================================
   🔌 初始化 Reown AppKit
   ============================================================ */
const metadata = {
  name: 'UFO Dollar',
  description: 'UFO Ecosystem — Private Settlement DApp',
  url: 'https://ufodollar.io',
  icons: ['https://ufodollar.io/icon.png'],
};

const ethersAdapter = new EthersAdapter();

createAppKit({
  adapters: [ethersAdapter],
  networks: [bsc],
  projectId: PROJECT_ID,
  metadata,
  features: { analytics: false },
});

/* ============================================================
   🎨 Cartoon Icon Set — 与 RulesTab 同款笔画风格
   ============================================================ */
const CartoonIcon = ({ type, size = 26 }) => {
  const base = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (type) {
    case 'swap':
      return (
        <svg {...base}>
          <path d="M4 8h13l-3.5-3.5" />
          <path d="M20 16H7l3.5 3.5" />
        </svg>
      );
    case 'wallet':
      return (
        <svg {...base}>
          <rect x="3" y="6" width="18" height="13" rx="3.5" />
          <path d="M3 10h13a2.5 2.5 0 0 1 0 5H3" />
          <circle cx="17" cy="12.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'history':
      return (
        <svg {...base}>
          <path d="M3.5 12a8.5 8.5 0 1 1 2.6 6.1" />
          <path d="M3.5 18.5v-4h4" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
      );
    case 'coins':
      return (
        <svg {...base}>
          <ellipse cx="12" cy="7" rx="7" ry="2.8" />
          <path d="M5 7v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V7" />
          <path d="M5 12v5c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-5" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...base}>
          <path d="M20 11a8 8 0 0 0-14.3-4.6" />
          <path d="M4 13a8 8 0 0 0 14.3 4.6" />
          <path d="M20 5v5h-5" />
          <path d="M4 19v-5h5" />
        </svg>
      );
    case 'in':
      return (
        <svg {...base}>
          <path d="M12 4v12" />
          <path d="m6.5 10.5 5.5 5.5 5.5-5.5" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'out':
      return (
        <svg {...base}>
          <path d="M12 20V8" />
          <path d="m6.5 13.5 5.5-5.5 5.5 5.5" />
          <path d="M5 4h14" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...base}>
          <path d="M12 3 5 5.8v5.4c0 4.6 3 8.2 7 9.8 4-1.6 7-5.2 7-9.8V5.8L12 3z" />
          <path d="m8.8 12 2.2 2.2 4.2-4.4" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...base}>
          <path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
          <path d="m6.5 6.5 3 3M14.5 14.5l3 3M17.5 6.5l-3 3M9.5 14.5l-3 3" />
        </svg>
      );
    default:
      return null;
  }
};

/* ============================================================
   🧩 通用渐变卡片 — 与 RulesTab 完全同款
   ============================================================ */
const Card = ({ title, icon, gradient, glow, children }) => (
  <div
    style={{
      position: 'relative',
      overflow: 'hidden',
      isolation: 'isolate',
      padding: '22px 22px 24px',
      borderRadius: '28px',
      background: gradient,
      color: '#ffffff',
      boxShadow: `0 22px 45px -24px ${glow}, inset 0 1px 0 rgba(255,255,255,0.22)`,
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '-48px',
        right: '-38px',
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(255,255,255,0.30), rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
      }}
    />
    <span
      style={{
        position: 'absolute',
        bottom: '-64px',
        left: '-46px',
        width: '160px',
        height: '160px',
        borderRadius: '50%',
        background:
          'radial-gradient(circle, rgba(255,255,255,0.16), rgba(255,255,255,0) 70%)',
        pointerEvents: 'none',
      }}
    />

    <div
      style={{
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'inline-block',
          maxWidth: '100%',
          fontSize: '10.5px',
          fontWeight: 800,
          letterSpacing: '1.6px',
          textTransform: 'uppercase',
          lineHeight: 1.35,
          color: 'rgba(255,255,255,0.95)',
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.30)',
          padding: '7px 12px',
          borderRadius: '999px',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {title}
      </div>

      <div
        style={{
          flexShrink: 0,
          width: '48px',
          height: '48px',
          borderRadius: '17px',
          display: 'grid',
          placeItems: 'center',
          color: '#ffffff',
          background: 'rgba(255,255,255,0.20)',
          border: '1px solid rgba(255,255,255,0.40)',
          boxShadow:
            '0 10px 20px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.55)',
          transform: 'rotate(-4deg)',
        }}
      >
        <CartoonIcon type={icon} />
      </div>
    </div>

    <div style={{ position: 'relative' }}>{children}</div>
  </div>
);

/* ============================================================
   🧱 小组件
   ============================================================ */
const GradientInput = ({ value, onChange, placeholder, type = 'text', onMax }) => (
  <div style={{ position: 'relative', marginBottom: '12px' }}>
    <input
      type={type}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '14px 68px 14px 16px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.35)',
        background: 'rgba(255,255,255,0.16)',
        color: '#ffffff',
        fontSize: '15px',
        fontWeight: 600,
        outline: 'none',
      }}
    />
    {onMax && (
      <button
        type="button"
        onClick={onMax}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          padding: '6px 10px',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.45)',
          background: 'rgba(255,255,255,0.22)',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: 800,
          letterSpacing: '0.4px',
          cursor: 'pointer',
        }}
      >
        MAX
      </button>
    )}
  </div>
);

const TokenSwitch = ({ token, setToken }) => (
  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
    {['USDT', 'USDC'].map((sym) => {
      const active = token === sym;
      return (
        <button
          key={sym}
          type="button"
          onClick={() => setToken(sym)}
          style={{
            flex: 1,
            padding: '10px 0',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.35)',
            background: active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)',
            color: active ? '#0f172a' : '#ffffff',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {sym}
        </button>
      );
    })}
  </div>
);

const ActionButton = ({ onClick, disabled, children, variant = 'light' }) => {
  const style =
    variant === 'light'
      ? {
          background: 'rgba(255,255,255,0.95)',
          color: '#0f172a',
        }
      : {
          background: 'transparent',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.5)',
        };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...style,
        width: '100%',
        padding: '14px',
        borderRadius: '16px',
        border: style.border || 'none',
        fontWeight: 800,
        fontSize: '15px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: disabled ? 'none' : '0 10px 24px -12px rgba(0,0,0,0.55)',
        transition: 'all 0.2s',
      }}
    >
      {children}
    </button>
  );
};

const InfoRow = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px dashed rgba(255,255,255,0.18)',
      fontSize: '13.5px',
      color: 'rgba(255,255,255,0.92)',
    }}
  >
    <span style={{ fontWeight: 600 }}>{label}</span>
    <span style={{ fontWeight: 800 }}>{value}</span>
  </div>
);

/* ============================================================
   💱 本地历史记录
   ============================================================ */
const HISTORY_KEY = 'ufo_tx_history';

const loadHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveHistory = (list) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* 忽略 */
  }
};

/* ============================================================
   🔁 Swap 面板
   ============================================================ */
function SwapPanel({ account, walletProvider, refreshBalances, pushHistory }) {
  const [mode, setMode] = useState('mint');
  const [token, setToken] = useState('USDT');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [balances, setBalances] = useState({ USDT: '0', USDC: '0', UFO: '0' });

  /* 读取余额 */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!account || !walletProvider) return;
      try {
        const provider = new BrowserProvider(walletProvider);
        const userAddr = account;
        const erc20 = (addr) => new Contract(addr, ERC20_ABI, provider);
        const [u, t, c] = await Promise.all([
          erc20(CONFIG.UFO_ADDRESS).balanceOf(userAddr),
          erc20(CONFIG.USDT_ADDRESS).balanceOf(userAddr),
          erc20(CONFIG.USDC_ADDRESS).balanceOf(userAddr),
        ]);
        if (!cancelled) {
          setBalances({
            UFO: formatUnits(u, 18),
            USDT: formatUnits(t, 18),
            USDC: formatUnits(c, 18),
          });
        }
      } catch (err) {
        console.warn('余额读取失败', err);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [account, walletProvider]);

  const receivePreview = useMemo(() => {
    const n = parseFloat(amount);
    if (!n || isNaN(n) || n <= 0) return '0';
    const out = n * (1 - CONFIG.FEE_RATE);
    return out.toFixed(6);
  }, [amount]);

  const handleMax = () => {
    const key = mode === 'mint' ? token : 'UFO';
    const v = balances[key];
    if (v) setAmount(v);
  };

  const ensureConnected = () => {
    if (!account || !walletProvider) {
      setStatus('请先连接钱包');
      return false;
    }
    return true;
  };

  const doMint = async () => {
    if (!ensureConnected()) return;
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      setStatus('请输入有效数量');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const tokenAddr = token === 'USDT' ? CONFIG.USDT_ADDRESS : CONFIG.USDC_ADDRESS;

      const vault = new Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, signer);

      /* Emergency Pause 检查 */
      try {
        const isPaused = await vault.paused();
        if (isPaused) {
          setStatus('合约已被暂停，所有 Swap / Redeem 已拦截');
          setBusy(false);
          return;
        }
      } catch {
        /* 若 ABI 无 paused，则忽略 */
      }

      const tokenC = new Contract(tokenAddr, ERC20_ABI, signer);
      const raw = parseUnits(amount, 18);
      const allowance = await tokenC.allowance(account, CONFIG.VAULT_ADDRESS);
      if (allowance < raw) {
        setStatus(`正在授权 ${token}...`);
        const ap = await tokenC.approve(CONFIG.VAULT_ADDRESS, MaxUint256);
        await ap.wait();
      }

      setStatus('正在执行 Mint...');
      const tx = await vault.mint(tokenAddr, raw);
      const rc = await tx.wait();

      pushHistory({
        hash: rc.hash,
        type: 'Mint',
        token,
        amount,
        status: 'success',
        time: Date.now(),
      });
      setStatus(`Mint 成功：${amount} ${token} → ~${receivePreview} UFO`);
      setAmount('');
      refreshBalances && refreshBalances();
    } catch (err) {
      console.error(err);
      const msg = err?.shortMessage || err?.message || '交易失败';
      pushHistory({
        hash: '-',
        type: 'Mint',
        token,
        amount,
        status: 'failed',
        time: Date.now(),
      });
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  };

  const doRedeem = async () => {
    if (!ensureConnected()) return;
    const n = parseFloat(amount);
    if (!n || n <= 0) {
      setStatus('请输入有效数量');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const provider = new BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const tokenAddr = token === 'USDT' ? CONFIG.USDT_ADDRESS : CONFIG.USDC_ADDRESS;

      const vault = new Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, signer);

      try {
        const isPaused = await vault.paused();
        if (isPaused) {
          setStatus('合约已被暂停，所有 Swap / Redeem 已拦截');
          setBusy(false);
          return;
        }
      } catch {
        /* 忽略 */
      }

      /* UFO 需要先授权给 Vault */
      const ufo = new Contract(CONFIG.UFO_ADDRESS, ERC20_ABI, signer);
      const raw = parseUnits(amount, 18);
      const allowance = await ufo.allowance(account, CONFIG.VAULT_ADDRESS);
      if (allowance < raw) {
        setStatus('正在授权 UFO...');
        const ap = await ufo.approve(CONFIG.VAULT_ADDRESS, MaxUint256);
        await ap.wait();
      }

      setStatus('正在执行 Redeem...');
      const tx = await vault.redeem(tokenAddr, raw);
      const rc = await tx.wait();

      pushHistory({
        hash: rc.hash,
        type: 'Redeem',
        token,
        amount,
        status: 'success',
        time: Date.now(),
      });
      setStatus(`Redeem 成功：${amount} UFO → ~${receivePreview} ${token}`);
      setAmount('');
      refreshBalances && refreshBalances();
    } catch (err) {
      console.error(err);
      const msg = err?.shortMessage || err?.message || '交易失败';
      pushHistory({
        hash: '-',
        type: 'Redeem',
        token,
        amount,
        status: 'failed',
        time: Date.now(),
      });
      setStatus(msg);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = mode === 'mint' ? doMint : doRedeem;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 模式切换 */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '6px',
          background: '#e2e8f0',
          borderRadius: '999px',
        }}
      >
        {[
          { k: 'mint', label: 'Mint UFO' },
          { k: 'redeem', label: 'Redeem UFO' },
        ].map((m) => {
          const active = mode === m.k;
          return (
            <button
              key={m.k}
              type="button"
              onClick={() => {
                setMode(m.k);
                setAmount('');
                setStatus('');
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: '999px',
                border: 'none',
                background: active
                  ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                  : 'transparent',
                color: active ? '#ffffff' : '#475569',
                fontWeight: 800,
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: active ? '0 8px 18px -10px rgba(37,99,235,0.6)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 主操作卡片 */}
      {mode === 'mint' ? (
        <Card
          title="Mint UFO · Swap In"
          icon="in"
          gradient="linear-gradient(145deg, #22d3ee 0%, #0ea5e9 50%, #1d4ed8 100%)"
          glow="rgba(14,165,233,0.50)"
        >
          <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'rgba(255,255,255,0.92)', marginBottom: '16px' }}>
            使用 USDT / USDC 兑换 UFO，费率 <b>0.5%</b>。链上会实时读取 Chainlink 价格并拦截价格异常。
          </p>

          <TokenSwitch token={token} setToken={setToken} />
          <GradientInput
            value={amount}
            onChange={setAmount}
            placeholder={`输入 ${token} 数量`}
            onMax={handleMax}
          />

          <div style={{ marginBottom: '14px' }}>
            <InfoRow label="可用余额" value={`${parseFloat(balances[token]).toFixed(4)} ${token}`} />
            <InfoRow label="结算费率" value={`${(CONFIG.FEE_RATE * 100).toFixed(2)} %`} />
            <InfoRow label="预估获得" value={`~${receivePreview} UFO`} />
          </div>

          <ActionButton onClick={onSubmit} disabled={busy}>
            {busy ? '处理中...' : `Mint UFO with ${token}`}
          </ActionButton>

          {status && (
            <div
              style={{
                marginTop: '12px',
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.95)',
                background: 'rgba(0,0,0,0.18)',
                padding: '10px 12px',
                borderRadius: '12px',
                wordBreak: 'break-word',
              }}
            >
              {status}
            </div>
          )}
        </Card>
      ) : (
        <Card
          title="Redeem UFO · Swap Out"
          icon="out"
          gradient="linear-gradient(145deg, #a78bfa 0%, #8b5cf6 55%, #6d28d9 100%)"
          glow="rgba(139,92,246,0.50)"
        >
          <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'rgba(255,255,255,0.92)', marginBottom: '16px' }}>
            将 UFO 换回 USDT / USDC，费率 <b>0.5%</b>。交易前会先查询 Vault 实时流动性，避免因池子不足失败。
          </p>

          <TokenSwitch token={token} setToken={setToken} />
          <GradientInput
            value={amount}
            onChange={setAmount}
            placeholder="输入 UFO 数量"
            onMax={handleMax}
          />

          <div style={{ marginBottom: '14px' }}>
            <InfoRow label="可用 UFO" value={`${parseFloat(balances.UFO).toFixed(4)} UFO`} />
            <InfoRow label="结算费率" value={`${(CONFIG.FEE_RATE * 100).toFixed(2)} %`} />
            <InfoRow label="预估获得" value={`~${receivePreview} ${token}`} />
          </div>

          <ActionButton onClick={onSubmit} disabled={busy}>
            {busy ? '处理中...' : `Redeem UFO for ${token}`}
          </ActionButton>

          {status && (
            <div
              style={{
                marginTop: '12px',
                fontSize: '12.5px',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.95)',
                background: 'rgba(0,0,0,0.18)',
                padding: '10px 12px',
                borderRadius: '12px',
                wordBreak: 'break-word',
              }}
            >
              {status}
            </div>
          )}
        </Card>
      )}

      {/* 安全提示卡 */}
      <Card
        title="Security Notice"
        icon="shield"
        gradient="linear-gradient(145deg, #475569 0%, #334155 55%, #1e293b 100%)"
        glow="rgba(51,65,85,0.50)"
      >
        <p style={{ fontSize: '13.5px', lineHeight: 1.7, color: 'rgba(255,255,255,0.92)' }}>
          所有操作均在 BSC 主网执行。若 Vault 处于暂停状态，前端将拦截 EVM revert 并阻止 Swap / Redeem。
        </p>
      </Card>
    </div>
  );
}

/* ============================================================
   👛 Wallet 面板
   ============================================================ */
function WalletPanel({ account, walletProvider }) {
  const [balances, setBalances] = useState({ UFO: '0', USDT: '0', USDC: '0' });
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(loadHistory());

  const loadAll = useCallback(async () => {
    if (!account || !walletProvider) return;
    setLoading(true);
    try {
      const provider = new BrowserProvider(walletProvider);
      const erc20 = (addr) => new Contract(addr, ERC20_ABI, provider);
      const [u, t, c] = await Promise.all([
        erc20(CONFIG.UFO_ADDRESS).balanceOf(account),
        erc20(CONFIG.USDT_ADDRESS).balanceOf(account),
        erc20(CONFIG.USDC_ADDRESS).balanceOf(account),
      ]);
      setBalances({
        UFO: formatUnits(u, 18),
        USDT: formatUnits(t, 18),
        USDC: formatUnits(c, 18),
      });
    } catch (err) {
      console.warn('余额读取失败', err);
    } finally {
      setLoading(false);
    }
  }, [account, walletProvider]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const onStorage = () => setHistory(loadHistory());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const clearHistory = () => {
    saveHistory([]);
    setHistory([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 资产总览 */}
      <Card
        title="Asset Overview"
        icon="wallet"
        gradient="linear-gradient(145deg, #60a5fa 0%, #3b82f6 55%, #1e40af 100%)"
        glow="rgba(59,130,246,0.50)"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '10px',
            marginBottom: '16px',
          }}
        >
          {[
            { k: 'UFO', label: 'UFO', v: balances.UFO, color: 'rgba(255,255,255,0.95)' },
            { k: 'USDT', label: 'USDT', v: balances.USDT, color: 'rgba(255,255,255,0.95)' },
            { k: 'USDC', label: 'USDC', v: balances.USDC, color: 'rgba(255,255,255,0.95)' },
          ].map((it) => (
            <div
              key={it.k}
              style={{
                background: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.28)',
                borderRadius: '16px',
                padding: '12px 10px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '1.2px',
                  color: 'rgba(255,255,255,0.85)',
                  marginBottom: '6px',
                }}
              >
                {it.label}
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: it.color, wordBreak: 'break-all' }}>
                {parseFloat(it.v || '0').toFixed(4)}
              </div>
            </div>
          ))}
        </div>

        <ActionButton onClick={loadAll} disabled={loading}>
          {loading ? '刷新中...' : '刷新余额'}
        </ActionButton>

        <div
          style={{
            marginTop: '12px',
            fontSize: '12.5px',
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.88)',
          }}
        >
          当前地址：
          <span style={{ wordBreak: 'break-all', fontWeight: 700 }}>
            {account || '未连接钱包'}
          </span>
        </div>
      </Card>

      {/* 交易历史 */}
      <Card
        title="Local History Log"
        icon="history"
        gradient="linear-gradient(145deg, #f472b6 0%, #db2777 55%, #9d174d 100%)"
        glow="rgba(219,39,119,0.50)"
      >
        <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'rgba(255,255,255,0.92)', marginBottom: '14px' }}>
          记录仅保存在当前浏览器 <b>localStorage</b> 中，不会上传，作为你的私人交易凭证。
        </p>

        {history.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '22px 0',
              fontSize: '13px',
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.10)',
              borderRadius: '14px',
              border: '1px dashed rgba(255,255,255,0.32)',
            }}
          >
            暂无交易记录
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
            {history.map((h, i) => (
              <div
                key={`${h.hash}-${i}`}
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  border: '1px solid rgba(255,255,255,0.28)',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,0.95)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800 }}>{h.type} · {h.token}</span>
                  <span
                    style={{
                      fontWeight: 800,
                      color: h.status === 'success' ? '#bbf7d0' : '#fecaca',
                    }}
                  >
                    {h.status === 'success' ? '成功' : '失败'}
                  </span>
                </div>
                <div>数量：{h.amount}</div>
                <div style={{ wordBreak: 'break-all', opacity: 0.85 }}>Tx: {h.hash}</div>
                <div style={{ opacity: 0.7 }}>
                  {new Date(h.time).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '14px' }}>
          <ActionButton onClick={clearHistory} variant="ghost">
            清空本地记录
          </ActionButton>
        </div>
      </Card>

      {/* 合约信息 */}
      <Card
        title="Contract Addresses"
        icon="coins"
        gradient="linear-gradient(145deg, #34d399 0%, #10b981 55%, #047857 100%)"
        glow="rgba(16,185,129,0.50)"
      >
        {[
          { label: 'Vault', addr: CONFIG.VAULT_ADDRESS },
          { label: 'UFO Token', addr: CONFIG.UFO_ADDRESS },
          { label: 'USDT', addr: CONFIG.USDT_ADDRESS },
          { label: 'USDC', addr: CONFIG.USDC_ADDRESS },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              padding: '10px 0',
              borderBottom: '1px dashed rgba(255,255,255,0.18)',
            }}
          >
            <span style={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '1px', opacity: 0.85 }}>
              {row.label}
            </span>
            <span style={{ fontSize: '12.5px', wordBreak: 'break-all', fontWeight: 600 }}>
              {row.addr}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

/* ============================================================
   🚀 App 主组件
   ============================================================ */
export default function App() {
  const [tab, setTab] = useState('swap');
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { open } = useAppKit();

  const [history, setHistory] = useState(loadHistory());

  const pushHistory = useCallback((item) => {
    setHistory((prev) => {
      const next = [item, ...prev].slice(0, 50);
      saveHistory(next);
      return next;
    });
  }, []);

  const refreshBalances = useCallback(() => {
    /* 通过 tab 切换触发 WalletPanel 内部刷新 */
    setTab((t) => t);
  }, []);

  const tabs = [
    { k: 'swap', label: 'Swap', icon: 'swap' },
    { k: 'wallet', label: 'Wallet', icon: 'wallet' },
    { k: 'rules', label: 'Rules', icon: 'sparkle' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: '#f8fafc',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 18px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'grid',
              placeItems: 'center',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '16px',
              boxShadow: '0 8px 20px -10px rgba(37,99,235,0.7)',
            }}
          >
            🛸
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>
              UFO Ecosystem
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '1.2px' }}>
              PRIVATE SETTLEMENT
            </div>
          </div>
        </div>

        {/* 钱包连接按钮 —— Reown 官方 Web Component */}
        <appkit-button />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          margin: '6px 18px 10px',
          padding: '5px',
          background: '#e2e8f0',
          borderRadius: '999px',
        }}
      >
        {tabs.map((t) => {
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 0',
                borderRadius: '999px',
                border: 'none',
                background: active
                  ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                  : 'transparent',
                color: active ? '#ffffff' : '#475569',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: active ? '0 8px 18px -10px rgba(37,99,235,0.6)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ display: 'inline-flex' }}>
                <CartoonIcon type={t.icon} size={16} />
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 16px 28px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tab === 'swap' && (
          <SwapPanel
            account={address}
            walletProvider={walletProvider}
            refreshBalances={refreshBalances}
            pushHistory={pushHistory}
          />
        )}
        {tab === 'wallet' && (
          <WalletPanel account={address} walletProvider={walletProvider} />
        )}
        {tab === 'rules' && <RulesTab />}
      </div>

      {/* 底部状态栏 */}
      <div
        style={{
          padding: '10px 16px 14px',
          fontSize: '11px',
          color: '#94a3b8',
          textAlign: 'center',
          letterSpacing: '0.6px',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}
      >
        UFO Dollar · BSC Mainnet · Settlement Fee 0.5%
        {!address && (
          <span>
            {' · '}
            <span
              onClick={() => open()}
              style={{ color: '#2563eb', fontWeight: 800, cursor: 'pointer' }}
            >
              连接钱包
            </span>
          </span>
        )}
      </div>
    </div>
  );
}