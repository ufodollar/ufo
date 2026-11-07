import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// ================= 配置区 =================
// ⚠️ 请务必替换为你真实的合约地址
const VAULT_ADDRESS = '0x你的BSC金库地址'; 
const UFO_ADDRESS = '0x你的BSC_UFO地址';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
const AAVE_POOL_ADDRESS = '0x6807dc923806fE8Fd134338EABCA509979a7e0cB'; // BSC Aave V3 Pool

const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
// ==========================================

const ERC20_ABI = [
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)" 
];

const VAULT_ABI = [
  "function deposit(uint256)", 
  "function withdraw(uint256)",
  "function getExchangeRate() view returns (uint256)"
];

const AAVE_POOL_ABI = [
  "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)"
];

// 指定的 7 个钱包
const WALLETS = [
  { id: "phantom", name: "Phantom", icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Phantom_wallet_logo.svg/512px-Phantom_wallet_logo.svg.png", desc: "多链极简钱包", url: "https://phantom.app/ul/browse/" },
  { id: "metamask", name: "MetaMask", icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg", desc: "全球最广泛使用的钱包", url: "https://metamask.app.link/dapp/" },
  { id: "trust", name: "Trust Wallet", icon: "https://trustwallet.com/assets/images/media/assets/TWT.svg", desc: "全球领先的移动端钱包", url: "https://link.trustwallet.com/open_url?coin_id=60&url=" },
  { id: "binance", name: "Binance Wallet", icon: "https://upload.wikimedia.org/wikipedia/commons/e/e8/Binance_Logo.svg", desc: "币安官方 Web3 钱包", url: "https://app.binance.com/en/download" },
  { id: "mywallet", name: "MyWallet", icon: "https://www.myetherwallet.com/favicon.ico", desc: "经典以太坊轻钱包", url: "https://www.myetherwallet.com/" },
  { id: "safepal", name: "SafePal", icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/5864.png", desc: "币安投资的硬件/软件钱包", url: "https://www.safepal.com/" },
  { id: "rainbow", name: "Rainbow", icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/20755.png", desc: "以太坊上最绚丽的钱包", url: "https://rnbwapp.com/" }
];

const SwitchIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
  </svg>
);

// 音效逻辑保持不变
let globalAudioCtx = null;
const getAudioContext = () => {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    globalAudioCtx = new AudioContext();
  }
  if (globalAudioCtx.state === 'suspended') globalAudioCtx.resume();
  return globalAudioCtx;
};

const playClickSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now); 
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.4);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 15; 
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15; 
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(280, now);
    osc2.frequency.exponentialRampToValueAtTime(140, now + 0.3);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gainNode); gainNode.connect(ctx.destination);
    osc2.connect(gain2); gain2.connect(ctx.destination);

    osc.start(now); osc.stop(now + 0.6);
    osc2.start(now); osc2.stop(now + 0.4);
    lfo.start(now); lfo.stop(now + 0.6);
  } catch (e) { }
};

const formatAmount = (val) => {
  if (!val) return '0.0';
  const num = parseFloat(val);
  if (num === 0) return '0.0';
  return num.toFixed(4).replace(/\.?0+$/, ''); 
};

export default function App() {
  const [address, setAddress] = useState('');
  const [signer, setSigner] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const [isDepositMode, setIsDepositMode] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [usdtBalance, setUsdtBalance] = useState('0.0');
  const [ufoBalance, setUfoBalance] = useState('0.0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [showRules, setShowRules] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  const [nav, setNav] = useState(1); 
  const [apy, setApy] = useState('0.00'); 

  // 绑定全局点击音效
  useEffect(() => {
    const handleGlobalClick = () => { playClickSound(); };
    window.addEventListener('click', handleGlobalClick);
    return () => { window.removeEventListener('click', handleGlobalClick); };
  }, []);

  // 获取 Aave APY
  useEffect(() => {
    const fetchApy = async () => {
      try {
        const pool = new ethers.Contract(AAVE_POOL_ADDRESS, AAVE_POOL_ABI, rpcProvider);
        const data = await pool.getReserveData(USDT_ADDRESS);
        const rate = data[2]; // currentLiquidityRate
        const apyVal = (Number(rate) / 1e27) * 100;
        setApy(apyVal.toFixed(2));
      } catch (err) {
        console.error("Failed to fetch APY", err);
      }
    };
    fetchApy();
  }, []);

  // 获取余额和 NAV
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
    } catch (err) {
      console.error("Fetch Data Error", err);
    }
  };

  useEffect(() => {
    if (isConnected) fetchData();
  }, [isConnected, address]);

  // 连接钱包逻辑
  const connectWallet = async (walletId) => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        // 请求切换到 BSC
        await _provider.send("wallet_switchEthereumChain", [{ chainId: "0x38" }]).catch(async (switchError) => {
          if (switchError.code === 4902) {
            await _provider.send("wallet_addEthereumChain", [{
              chainId: "0x38",
              chainName: "BNB Smart Chain",
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: ["https://bsc-dataseed.binance.org/"],
              blockExplorerUrls: ["https://bscscan.com/"]
            }]);
          }
        });

        const accounts = await _provider.send("eth_requestAccounts", []);
        const _signer = await _provider.getSigner();
        setSigner(_signer);
        setAddress(accounts[0]);
        setIsConnected(true);
        setShowWalletModal(false);
        setMsg('');
      } catch (err) {
        setMsg("连接失败: " + (err.shortMessage || err.message));
      }
    } else {
      // 手机端唤起
      const wallet = WALLETS.find(w => w.id === walletId);
      const currentUrl = window.location.href;
      if (walletId === "metamask" || walletId === "trust" || walletId === "phantom") {
        window.location.href = wallet.url + encodeURIComponent(currentUrl);
      } else {
        navigator.clipboard.writeText(currentUrl);
        setMsg("网址已复制！请打开对应钱包 App 粘贴访问。");
        setShowWalletModal(false);
      }
    }
  };

  // 交易逻辑
  const handleAction = async () => {
    if (!signer) return setMsg("请先连接钱包");
    if (!inputAmount || Number(inputAmount) <= 0) return setMsg("请输入有效金额");
    
    setIsProcessing(true);
    setMsg('');
    try {
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
      setMsg(err.reason || err.shortMessage || "交易失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const estimatedOutput = inputAmount 
    ? (isDepositMode ? (Number(inputAmount) / (nav || 1)) : (Number(inputAmount) * (nav || 1))) 
    : 0;

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-800 font-sans flex flex-col items-center pt-8 px-4 pb-20 relative overflow-hidden">
      {/* 浅色渐变光晕背景 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* 顶部 Header */}
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🛸</div>
            <h1 className="text-2xl font-bold text-slate-800">UFO<span className="text-blue-500">基金</span></h1>
          </div>
          {isConnected ? (
            <div className="bg-white px-4 py-2 rounded-full text-sm font-mono border border-slate-200 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {address.slice(0, 4)}...{address.slice(-4)}
            </div>
          ) : (
            <button
              onClick={() => setShowWalletModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium px-5 py-2 rounded-full transition-colors shadow-md text-sm"
            >
              连接钱包
            </button>
          )}
        </header>

        {/* 余额卡片 */}
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

        {/* 交互面板 */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white">
          {/* Tab 切换 */}
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

          {/* 输入框区 (上) */}
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

          {/* 中间切换按钮 */}
          <div className="flex justify-center -my-3 relative z-10">
            <button 
              onClick={() => setIsDepositMode(!isDepositMode)}
              className="bg-white border border-slate-100 p-2 rounded-full shadow-md text-blue-500 hover:bg-slate-50 transition-colors"
            >
              <SwitchIcon />
            </button>
          </div>

          {/* 输出框区 (下) */}
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

          {/* 操作按钮 */}
          <button
            onClick={isConnected ? handleAction : () => setShowWalletModal(true)}
            disabled={isProcessing}
            className={`w-full py-4 rounded-2xl text-lg font-bold shadow-lg transition-all ${
              isConnected 
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/30' 
                : 'bg-blue-400 hover:bg-blue-500 text-white shadow-blue-400/30'
            } disabled:opacity-50`}
          >
            {isProcessing ? "处理中..." : (isConnected ? (isDepositMode ? "存入" : "赎回") : "连接钱包")}
          </button>
          
          {/* 错误/状态信息 */}
          {msg && (
            <div className="mt-4 text-center text-sm text-red-500 bg-red-50 py-2 rounded-lg">
              {msg}
            </div>
          )}
        </div>

        {/* 底部净值/APY 卡片 */}
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

      {/* ==================== 规则弹窗 ==================== */}
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

      {/* ==================== 钱包选择弹窗 (纯手写) ==================== */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">连接钱包</h3>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-3 overflow-y-auto space-y-1">
              {WALLETS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => connectWallet(w.id)}
                  className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center p-1.5 shrink-0">
                    <img src={w.icon} alt={w.name} className="w-full h-full object-contain" />
                  </div>
                  <div className="text-left">
                    <div className="text-slate-800 font-bold text-sm">{w.name}</div>
                    <div className="text-[11px] text-slate-400">{w.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}