import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. 初始化 Reown AppKit =================
const projectId = 'd6431212399f6c487b364387859983ea';
const metadata = {
  name: 'UFO 生态',
  description: 'UFO 稳定币兑换',
  url: window.location.origin,
  icons: []
};

try {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    metadata,
    projectId,
    features: { analytics: true, allWallets: { showWallets: true } }
  });
} catch (error) {
  console.error("AppKit 初始化崩溃:", error);
}

// ================= 2. 配置区 =================
// ⚠️ 请替换为你真实的合约地址
const VAULT_ADDRESS = '0x你的BSC金库地址'; 
const UFO_ADDRESS = '0x你的BSC_UFO地址';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function allowance(address, address) view returns (uint256)", "function approve(address, uint256) returns (bool)"];
const VAULT_ABI = ["function deposit(uint256)", "function withdraw(uint256)", "function getExchangeRate() view returns (uint256)"];

const FEE_RATE = 0.005; // 0.5% 手续费

// ================= 3. 主组件 =================
function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const [isBuyingUFO, setIsBuyingUFO] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('0.0');
  const [currentNav, setCurrentNav] = useState(10); // 默认 1 UFO = 10 USDT

  // 获取链上实时汇率
  useEffect(() => {
    const fetchNav = async () => {
      try {
        const rpc = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, rpc);
        const rate = await vault.getExchangeRate();
        setCurrentNav(parseFloat(ethers.formatUnits(rate, 18)));
      } catch (error) {
        console.warn("获取汇率失败，使用默认值 10.0");
      }
    };
    fetchNav();
  }, []);

  // 计算兑换结果
  useEffect(() => {
    const input = parseFloat(inputAmount);
    if (isNaN(input) || input <= 0) {
      setOutputAmount('0.0');
      return;
    }
    let output = 0;
    if (isBuyingUFO) {
      output = (input * (1 - FEE_RATE)) / (currentNav || 1);
    } else {
      output = (input * (currentNav || 1)) * (1 - FEE_RATE);
    }
    setOutputAmount(output.toFixed(4).replace(/\.?0+$/, ''));
  }, [inputAmount, isBuyingUFO, currentNav]);

  // 切换模式
  const toggleMode = () => {
    setIsBuyingUFO(!isBuyingUFO);
    setInputAmount('');
    setOutputAmount('0.0');
  };

  // 执行交易
  const handleAction = async () => {
    if (!isConnected) {
      open({ view: 'AllWallets' });
      return;
    }
    if (!inputAmount || Number(inputAmount) <= 0) {
      alert("请输入有效金额");
      return;
    }
    alert(`准备${isBuyingUFO ? '兑换' : '赎回'}，金额: ${inputAmount}`);
    // 这里后续接入合约的 deposit / withdraw 逻辑
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      
      {/* 顶部 Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 渐变 UFO 图标 */}
          <div style={{ width: '36px', height: '36px', background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '6px' }}>
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="ufo-body" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="ufo-glass" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#e0f2fe" />
                  <stop offset="100%" stopColor="#bae6fd" />
                </linearGradient>
              </defs>
              <path d="M 30 50 C 30 25, 70 25, 70 50 Z" fill="url(#ufo-glass)" />
              <ellipse cx="50" cy="55" rx="45" ry="16" fill="url(#ufo-body)" />
              <circle cx="35" cy="55" r="4" fill="#fff" />
              <circle cx="50" cy="57" r="4" fill="#fff" />
              <circle cx="65" cy="55" r="4" fill="#fff" />
            </svg>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 'bold' }}>UFO<span style={{ color: '#3b82f6' }}>兑换</span></span>
        </div>

        {isConnected ? (
          <span style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontFamily: 'monospace' }}>
            {address.slice(0, 4)}...{address.slice(-4)}
          </span>
        ) : (
          <button 
            onClick={() => open({ view: 'AllWallets' })} 
            style={{ background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            连接钱包
          </button>
        )}
      </div>

      {/* 兑换面板 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
        <h3 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '18px' }}>闪兑</h3>

        {/* 支付输入框 */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>你支付</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input 
              type="number" 
              value={inputAmount} 
              onChange={(e) => setInputAmount(e.target.value)}
              placeholder="0.0"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '32px', fontWeight: 'bold', outline: 'none', width: '100%' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
              {isBuyingUFO ? (
                <>
                  <img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{ width: '20px', height: '20px' }} alt="USDT" />
                  <span>USDT</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 100 100" style={{ width: '20px', height: '20px' }}><ellipse cx="50" cy="55" rx="45" ry="16" fill="#3b82f6" /></svg>
                  <span>UFO</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 中间切换按钮 */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-16px 0', position: 'relative', zIndex: 10 }}>
          <button 
            onClick={toggleMode}
            style={{ background: '#1e293b', border: '4px solid #0f172a', width: '48px', height: '48px', borderRadius: '50%', color: '#00f2fe', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 10l5-5 5 5"/><path d="M7 14l5 5 5-5"/></svg>
          </button>
        </div>

        {/* 接收输入框 */}
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>您收到</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#94a3b8' }}>
              {outputAmount}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
              {isBuyingUFO ? (
                <>
                  <svg viewBox="0 0 100 100" style={{ width: '20px', height: '20px' }}><ellipse cx="50" cy="55" rx="45" ry="16" fill="#3b82f6" /></svg>
                  <span>UFO</span>
                </>
              ) : (
                <>
                  <img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{ width: '20px', height: '20px' }} alt="USDT" />
                  <span>USDT</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 汇率与提示 */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '12px', marginTop: '20px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
          实时汇率: 1 UFO ≈ <span style={{ color: '#00f2fe', fontWeight: 'bold' }}>{currentNav}</span> USDT
        </div>
        <div style={{ textAlign: 'center', fontSize: '12px', color: '#ef4444', marginTop: '8px' }}>
          * 双向兑换收取 0.5% 手续费
        </div>

        {/* 操作按钮 */}
        <button 
          onClick={handleAction}
          style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#000', border: 'none', borderRadius: '16px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '24px' }}
        >
          {!isConnected ? '连接钱包' : (isBuyingUFO ? '立即兑换' : '立即赎回')}
        </button>
      </div>

    </div>
  );
}

// 4. 挂载 React
const container = document.getElementById('root');
if (container) {
  container.innerHTML = '';
  createRoot(container).render(<App />);
}