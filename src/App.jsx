import { useState, useEffect } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider, useAppKitNetwork, createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import { ethers } from 'ethers';

// ================= 1. AppKit 初始化 =================
// ⚠️ 我填入了一个公共测试 ID，正式上线请换成你在 cloud.reown.com 申请的 ID
const PROJECT_ID = 'fc6b68ca2187a4e5e3b3b8c6a7c8e6d9'; 

const metadata = {
  name: 'UFO Fund',
  description: 'UFO Fund Web3 App',
  url: 'https://ufo-eea.pages.dev', 
  icons: ['https://ufo-eea.pages.dev/logo.png']
};

try {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    metadata,
    projectId: PROJECT_ID,
    features: { analytics: true }
  });
} catch (error) {
  console.error("AppKit 初始化失败:", error);
}

// ================= 2. 配置区 =================
const VAULT_ADDRESS = '0x你的BSC金库地址'; 
const UFO_ADDRESS = '0x你的BSC_UFO地址';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; 
const AAVE_POOL_ADDRESS = '0x6807dc923806fE8Fd134338EABCA509979a7e0cB';

const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");

const ERC20_ABI = [
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];
const VAULT_ABI = [
  "function deposit(uint256)", 
  "function withdraw(uint256)",
  "function getExchangeRate() view returns (uint256)"
];
const AAVE_POOL_ABI = [
  "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)"
];

// ================= 3. 工具函数 =================
const SwitchIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
  </svg>
);

const playClickSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now); 
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) { }
};

const formatAmount = (val) => {
  if (!val) return '0.0';
  const num = parseFloat(val);
  if (num === 0) return '0.0';
  return num.toFixed(4).replace(/\.?0+$/, ''); 
};

// ================= 4. 主组件 =================
export default function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { switchNetwork } = useAppKitNetwork();

  const [isDepositMode, setIsDepositMode] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [usdtBalance, setUsdtBalance] = useState('0.0');
  const [ufoBalance, setUfoBalance] = useState('0.0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [showRules, setShowRules] = useState(false);
  const [nav, setNav] = useState(1); 
  const [apy, setApy] = useState('0.00'); 

  useEffect(() => {
    const handleGlobalClick = () => { playClickSound(); };
    window.addEventListener('click', handleGlobalClick);
    return () => { window.removeEventListener('click', handleGlobalClick); };
  }, []);

  useEffect(() => {
    if (isConnected) { switchNetwork(bsc); }
  }, [isConnected, switchNetwork]);

  useEffect(() => {
    const fetchApy = async () => {
      try {
        const pool = new ethers.Contract(AAVE_POOL_ADDRESS, AAVE_POOL_ABI, rpcProvider);
        const data = await pool.getReserveData(USDT_ADDRESS);
        const rate = data[2]; 
        const apyVal = (Number(rate) / 1e27) * 100;
        setApy(apyVal.toFixed(2));
      } catch (err) { console.error("Fetch APY error", err); }
    };
    fetchApy();
  }, []);

  const fetchData = async () => {
    if (!isConnected || !address) return;
    try {
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, rpcProvider);
      const rate = await vaultContract.getExchangeRate();
      setNav(parseFloat(ethers.formatUnits(rate, 18)));

      const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, rpcProvider);
      const ufoContract = new ethers.Contract(UFO_ADDRESS, ERC20_ABI, rpcProvider);
      
      const uBal = await usdtContract.balanceOf(address);
      setUsdtBalance(ethers.formatUnits(uBal, 6));
      
      const ufoBal = await ufoContract.balanceOf(address);
      setUfoBalance(ethers.formatUnits(ufoBal, 18)); 
    } catch (err) { console.error("Fetch Data error", err); }
  };

  useEffect(() => {
    if (isConnected) fetchData();
  }, [isConnected, address]);

  const handleAction = async () => {
    if (!isConnected || !walletProvider) return open();
    if (!inputAmount || Number(inputAmount) <= 0) return setMsg("请输入有效金额");
    
    setIsProcessing(true);
    setMsg('');
    
    try {
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      
      if (isDepositMode) {
        const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
        const rawAmount = ethers.parseUnits(inputAmount, 6);
        
        const allowance = await usdt.allowance(address, VAULT_ADDRESS);
        if (allowance < rawAmount) {
          setMsg("正在授权 USDT...");
          const txApprove = await usdt.approve(VAULT_ADDRESS, ethers.MaxUint256);
          await txApprove.wait();
        }
        
        setMsg("正在存入并铸造...");
        const tx = await vault.deposit(rawAmount);
        await tx.wait();
        setMsg("存入成功！");
      } else {
        const rawAmount = ethers.parseUnits(inputAmount, 18);
        setMsg("正在赎回 USDT...");
        const tx = await vault.withdraw(rawAmount);
        await tx.wait();
        setMsg("赎回成功！");
      }
      
      setInputAmount('');
      fetchData();
    } catch (err) {
      setMsg(err.reason || err.shortMessage || err.message || "交易失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const estimatedOutput = inputAmount 
    ? (isDepositMode ? (Number(inputAmount) / (nav || 1)) : (Number(inputAmount) * (nav || 1))) 
    : 0;

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-800 font-sans flex flex-col items-center pt-8 px-4 pb-20 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

      <div className="w-full max-w-md relative z-10">
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🛸</div>
            <h1 className="text-2xl font-bold text-slate-800">UFO<span className="text-blue-500">基金</span></h1>
          </div>
          
          {isConnected ? (
            <button onClick={() => open({ view: 'Account' })} className="bg-white px-4 py-2 rounded-full text-sm font-mono border border-slate-200 shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {address?.slice(0, 4)}...{address?.slice(-4)}
            </button>
          ) : (
            <button
              onClick={() => open()} // 唤起 AppKit
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-5 py-2 rounded-full transition-colors shadow-md text-sm"
            >
              连接钱包
            </button>
          )}
        </header>

        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 shadow-sm border border-white flex justify-between items-center mb-4">
          <div>
            <div className="text-slate-500 text-xs mb-1">USDT余额</div>
            <div className="text-emerald-500 font-bold text-2xl">{formatAmount(usdtBalance)} <span className="text-sm">美元</span></div>
          </div>
          <div>
            <div className="text-slate-500 text-xs mb-1">UFO 平衡</div>
            <div className="text-emerald-500 font-bold text-2xl">{formatAmount(ufoBalance)} <span className="text-sm">美元</span></div>
          </div>
          <button onClick={() => setShowRules(true)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-4 py-1.5 rounded-full shadow-md transition-colors">
            规则
          </button>
        </div>

        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white">
          <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
            <button 
              onClick={() => { setIsDepositMode(true); setInputAmount(''); setMsg(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${isDepositMode ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
            >
              订金
            </button>
            <button 
              onClick={() => { setIsDepositMode(false); setInputAmount(''); setMsg(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${!isDepositMode ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
            >
              赎回
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm relative mb-2">
            <div className="flex justify-between text-sm text-slate-500 mb-2">
              <span>你{isDepositMode ? '支付' : '赎回'}</span>
              <span>余额: {isDepositMode ? formatAmount(usdtBalance) : formatAmount(ufoBalance)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <input 
                type="number" 
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="0.0"
                className="bg-transparent text-4xl font-bold text-slate-800 outline-none w-full placeholder-slate-300"
              />
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 shrink-0">
                {isDepositMode ? (
                  <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" alt="USDT" className="w-6 h-6" /><span className="font-bold text-slate-700">美元</span></>
                ) : (
                  <><span className="text-2xl">🛸</span><span className="font-bold text-slate-700">飞碟</span></>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <button 
              onClick={() => { setIsDepositMode(!isDepositMode); setInputAmount(''); }}
              className="bg-white border border-slate-100 p-2 rounded-full shadow-md text-blue-500 hover:bg-slate-50 transition-colors"
            >
              <SwitchIcon />
            </button>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm mt-2 mb-6">
            <div className="flex justify-between text-sm text-slate-500 mb-2">
              <span>您收到的金额（扣除费用后）</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="text-4xl font-bold text-slate-400 w-full truncate">
                {estimatedOutput > 0 ? formatAmount(estimatedOutput) : '0.0'}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 shrink-0">
                {isDepositMode ? (
                  <><span className="text-2xl">🛸</span><span className="font-bold text-slate-700">飞碟</span></>
                ) : (
                  <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" alt="USDT" className="w-6 h-6" /><span className="font-bold text-slate-700">美元</span></>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleAction}
            disabled={isProcessing}
            className={`w-full py-4 rounded-2xl text-lg font-bold shadow-lg transition-all ${
              isConnected 
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/30' 
                : 'bg-blue-400 hover:bg-blue-500 text-white shadow-blue-400/30'
            } disabled:opacity-50`}
          >
            {isProcessing ? "处理中..." : (isConnected ? (isDepositMode ? "存入" : "赎回") : "连接钱包")}
          </button>
          
          {msg && (
            <div className="mt-4 text-center text-sm text-red-500 bg-red-50 py-2 rounded-lg">
              {msg}
            </div>
          )}
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 mt-4 border border-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏦</span>
            <span className="text-slate-600 font-medium">净资产值</span>
          </div>
          <div className="text-emerald-500 font-bold">
            {apy !== '0.00' ? `APY ${apy}%` : '正在获取...'}
          </div>
        </div>
      </div>

      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6">
            <h3 className="text-xl font-bold mb-4">产品规则</h3>
            <ul className="text-sm text-slate-600 space-y-3">
              <li>• 1 UFO 兑换比例随金库 NAV 浮动。</li>
              <li>• 所有的 USDT 将进入底层 Aave 协议生息。</li>
              <li>• 赎回时需销毁 UFO，并扣除手续费。</li>
            </ul>
            <button onClick={() => setShowRules(false)} className="w-full mt-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl transition-colors">
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}