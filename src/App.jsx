import { useState, useEffect } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider, useAppKitNetwork } from '@reown/appkit/react';
import { ethers } from 'ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 配置区 =================
// ⚠️ 请务必替换为你真实的合约地址
const VAULT_ADDRESS = '0x你的BSC金库地址A'; 
const UFO_ADDRESS = '0x你的BSC_UFO地址';
// ==========================================

const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");

const UFO_LOGO = '/logo.png'; 
const USDT_LOGO = 'https://assets.coingecko.com/coins/images/325/large/Tether.png';

const ERC20_ABI = [
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)" 
];
const VAULT_ABI = [
  "function deposit(uint256)", 
  "function withdraw(uint256)",
  "function getExchangeRate() view returns (uint256)",
  "function lastHarvestBalance() view returns (uint256)" 
];

const SwitchIcon = () => (
  <svg className="switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
  </svg>
);

// 沉闷厚实的“哒”声
const playClickSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.03);
    
    oscGain.gain.setValueAtTime(0.8, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    const bufferSize = ctx.sampleRate * 0.01;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 800;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
    noiseNode.start(now);
    noiseNode.stop(now + 0.02);

  } catch (e) { }
};

const formatAmount = (val) => {
  if (!val) return '0.0';
  const num = parseFloat(val);
  if (num === 0) return '0.0';
  return num.toFixed(6).replace(/\.?0+$/, ''); 
};

function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { switchNetwork } = useAppKitNetwork();

  const [isDepositMode, setIsDepositMode] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [usdtBalance, setUsdtBalance] = useState('0');
  const [ufoBalance, setUfoBalance] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [isRedeemWindow, setIsRedeemWindow] = useState(false);
  const [chainDate, setChainDate] = useState(new Date());
  const [showRules, setShowRules] = useState(false);
  
  const [nav, setNav] = useState(1); 
  const [accumulatedYield, setAccumulatedYield] = useState('0');

  const currentYear = chainDate.getFullYear();

  // 🔥 核心优化 1：自动检测并唤起钱包连接 (针对从 X/Twitter 跳转过来的场景)
  useEffect(() => {
    const isWalletBrowser = window.ethereum || window.phantom;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && isWalletBrowser && !isConnected) {
      // 延迟 300ms 确保环境完全注入
      setTimeout(() => {
        open({ view: 'Connect' }); 
      }, 300);
    }
  }, [isConnected, open]);

  // 🔥 核心优化 2：连接成功后，强制切换网络到 BSC
  useEffect(() => {
    if (isConnected) {
      switchNetwork(bsc);
    }
  }, [isConnected, switchNetwork]);

  const fetchData = async () => {
    try {
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, rpcProvider);
      const ufoContract = new ethers.Contract(UFO_ADDRESS, ERC20_ABI, rpcProvider);
      
      const latestBlock = await rpcProvider.getBlock('latest');
      const blockDate = new Date(latestBlock.timestamp * 1000);
      setChainDate(blockDate);
      setIsRedeemWindow(blockDate.getUTCMonth() === 0); // 0 代表一月 (UTC时间)

      const rate = await vaultContract.getExchangeRate();
      const currentNav = parseFloat(ethers.formatUnits(rate, 18));
      setNav(currentNav);

      const totalPrincipal = await vaultContract.lastHarvestBalance(); 
      const totalUFO = await ufoContract.totalSupply();
      
      // 精度处理：本金(6位)转18位，aToken资产是18位
      const totalAssets = (rate * totalUFO) / BigInt(1e18); 
      const principal18 = totalPrincipal * BigInt(1e12);

      if (totalUFO > 0n && totalAssets > principal18) {
        const yieldAmount = totalAssets - principal18;
        setAccumulatedYield(ethers.formatUnits(yieldAmount, 18));
      } else {
        setAccumulatedYield('0');
      }

    } catch (e) { 
      console.log("Fetch Data Error:", e); 
    }
  };

  const fetchBalances = async () => {
    if (!address) return;
    try {
      const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, rpcProvider);
      const ufoContract = new ethers.Contract(UFO_ADDRESS, ERC20_ABI, rpcProvider);
      const usdtBal = await usdtContract.balanceOf(address);
      const ufoBal = await ufoContract.balanceOf(address);
      
      // 精度修复：USDT 是 6 精度，UFO 是 18 精度
      setUsdtBalance(ethers.formatUnits(usdtBal, 6));
      setUfoBalance(ethers.formatUnits(ufoBal, 18));
      
      fetchData(); 
    } catch (e) { }
  };

  useEffect(() => { 
    fetchBalances(); 
    
    const interval = setInterval(() => {
      fetchData();
    }, 60000);

    return () => clearInterval(interval);
  }, [address, isDepositMode]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val < 0 || val.includes('-')) {
      setMsg("Negative amounts are not allowed.");
      return;
    }
    setMsg(''); 
    setInputAmount(val);
  };

  const handleAction = async () => {
    playClickSound();
    if (!isConnected) return open();
    if (!inputAmount || inputAmount <= 0) return setMsg("Please enter a valid amount");
    if (!walletProvider) return setMsg("Provider not ready");
    
    if (isDepositMode && isRedeemWindow) return setMsg("Deposits are closed in January.");
    if (!isDepositMode && !isRedeemWindow) return setMsg("Redemption only available in January.");

    try {
      setIsProcessing(true);
      setMsg("");
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      
      const tokenAddress = isDepositMode ? USDT_ADDRESS : UFO_ADDRESS;
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      
      // 精度修复：存 USDT 用 6 精度，赎回 UFO 用 18 精度
      const amount = isDepositMode ? ethers.parseUnits(inputAmount, 6) : ethers.parseUnits(inputAmount, 18);

      const allowance = await tokenContract.allowance(address, VAULT_ADDRESS);
      if (allowance < amount) {
        setMsg(`Approving ${isDepositMode ? 'USDT' : 'UFO'}...`);
        const txApprove = await tokenContract.approve(VAULT_ADDRESS, ethers.MaxUint256);
        await txApprove.wait();
      }

      setMsg(isDepositMode ? "Depositing..." : "Redeeming...");
      const tx = isDepositMode ? await vaultContract.deposit(amount) : await vaultContract.withdraw(amount);
      await tx.wait();
      setMsg("Transaction Successful!");
      setInputAmount('');
      fetchBalances();
    } catch (err) {
      console.log(err);
      setMsg(err.message.includes('rejected') ? "Transaction Rejected." : "Transaction Failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentToken = isDepositMode ? 'USDT' : 'UFO';
  const currentIcon = isDepositMode ? USDT_LOGO : UFO_LOGO;
  const currentBalance = isDepositMode ? usdtBalance : ufoBalance;

  const receiveToken = isDepositMode ? 'UFO' : 'USDT';
  const receiveIcon = isDepositMode ? UFO_LOGO : USDT_LOGO;
  const receiveBalance = isDepositMode ? ufoBalance : usdtBalance;

  let receiveAmount = '0';
  if (inputAmount && !isNaN(inputAmount) && inputAmount > 0) {
    receiveAmount = isDepositMode ? (parseFloat(inputAmount) / nav).toString() : (parseFloat(inputAmount) * nav).toString();
  }

  const usdtValue = parseFloat(usdtBalance) * 1;
  const ufoValue = parseFloat(ufoBalance) * nav;

  return (
    <>
      <div className="bg-shape-square"></div>
      <div className="bg-shape-triangle"></div>

      <div className="app-container">
        <header className="header">
          <div className="logo-container">
            <img src={UFO_LOGO} alt="UFO Logo" className="brand-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="logo-text">UFO <span>Fund</span></div>
          </div>
          <button className="btn-connect" onClick={() => { playClickSound(); open(); }}>
            {isConnected ? (
              <><span>{address.slice(0,6)}...{address.slice(-4)}</span><SwitchIcon /></>
            ) : (
              <>Connect Wallet</>
            )}
          </button>
        </header>

        {isConnected && (
          <div className="asset-dashboard">
            <div className="balance-group">
              <div className="balance-item">
                <span className="asset-balance-label">USDT Balance</span>
                <span className="asset-balance-value">${formatAmount(usdtValue)}</span>
              </div>
              <div className="balance-item">
                <span className="asset-balance-label">UFO Balance</span>
                <span className="asset-balance-value">${formatAmount(ufoValue)}</span>
              </div>
            </div>
            
            <div className="action-buttons-group">
              <button className="btn-rules" onClick={() => { playClickSound(); setShowRules(true); }}>
                Rules
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="tabs">
            <button className={`tab ${isDepositMode ? 'active' : ''}`} onClick={() => { playClickSound(); setIsDepositMode(true); setInputAmount(''); setMsg(''); }}>Deposit</button>
            <button className={`tab ${!isDepositMode ? 'active' : ''}`} onClick={() => { playClickSound(); setIsDepositMode(false); setInputAmount(''); setMsg(''); }}>Redeem</button>
          </div>

          <div className="input-box">
            <div className="input-label">
              <span>{isDepositMode ? 'You Pay' : 'You Redeem'}</span>
              <span className="balance" onClick={() => { playClickSound(); setInputAmount(currentBalance); }}>
                <span className="balance-label">Balance: </span>
                <span className="balance-value">{formatAmount(currentBalance)}</span>
              </span>
            </div>
            <div className="input-row">
              <input type="number" className="input-field" value={inputAmount} onChange={handleInputChange} placeholder="0.0" min="0" />
              <div className="token-tag">
                <img src={currentIcon} alt={currentToken} />
                {currentToken}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '8px 0', color: 'var(--accent)' }}>↓</div>

          <div className="input-box">
            <div className="input-label">
              <span>{isDepositMode ? 'You Receive' : 'You Receive (Dynamic Rate)'}</span>
              <span className="balance" style={{ cursor: 'default' }}>
                <span className="balance-label">Balance: </span>
                <span className="balance-value">{formatAmount(receiveBalance)}</span>
              </span>
            </div>
            <div className="input-row">
              <input type="text" className="input-field" value={receiveAmount === '0' ? '' : formatAmount(receiveAmount)} readOnly placeholder="0.0" />
              <div className="token-tag">
                <img src={receiveIcon} alt={receiveToken} />
                {receiveToken}
              </div>
            </div>
          </div>

          <button className="action-btn" onClick={handleAction} disabled={isProcessing || !isConnected || (!inputAmount && isConnected)}>
            {isProcessing ? 'Processing...' : !isConnected ? 'Connect Wallet' : (!inputAmount ? 'Enter Amount' : (isDepositMode ? 'Deposit & Earn' : 'Redeem'))}
          </button>
          
          {msg && <p className={`msg-text ${msg.includes('Success') ? 'success' : 'error'}`}>{msg}</p>}
        </div>

        <div className="info-section">
          <div className="info-item">
            <span className="info-label"><span className="big-icon">🏦</span> Current UFO Price</span>
            <span className="info-value green">${nav.toFixed(4)}</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">📈</span> {currentYear} Accumulated Yield</span>
            <span className="info-value green">${formatAmount(accumulatedYield)}</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">🛒</span> Deposit Period</span>
            <span className="info-value blue">Feb - Dec, Dynamic Pricing</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">💸</span> Redemption Period</span>
            <span className="info-value purple">Jan 1-31 of next year</span>
          </div>
        </div>

        <a href="https://t.me/ufofund" target="_blank" rel="noopener noreferrer" className="social-link" onClick={playClickSound}>
          Contact Fund Manager
        </a>
        
        <div className="footer-text">Secured by Aave V3 on BSC.<br/>Smart contracts are audited and fully on-chain.</div>

        {showRules && (
          <div className="modal-overlay" onClick={() => { playClickSound(); setShowRules(false); }}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header"><h3>UFO Fund Rules</h3><button className="btn-close" onClick={() => { playClickSound(); setShowRules(false); }}>×</button></div>
              <div className="rules-content">
                <div className="rule-block"><h4>1. How It Works</h4><p>You can buy UFO tokens on any day within a 365-day cycle. We deposit your USDT into Aave V3 to earn safe interest. The longer you hold, the more interest you accrue.</p></div>
                <div className="rule-block"><h4>2. When to Redeem</h4><p>Our redemption window is from Jan 1st to Jan 31st every year. When you redeem all your UFO, you will receive not only your principal but also additional interest, which is 50% of the interest generated by your principal.</p></div>
                <div className="rule-block"><h4>3. Performance Fee</h4><p>We charge a 50% performance fee from the interest generated to cover platform operational costs.</p></div>
                <div className="rule-block"><h4>4. Dynamic Pricing</h4><p>In January, the UFO purchase price is fixed at 1 USDT. During other months, the UFO purchase price fluctuates dynamically based on the vault's NAV. Within a single calendar year, UFOs purchased earlier will earn more interest than those purchased later.</p></div>
                <div className="rule-block" style={{ borderColor: 'var(--accent)' }}><h4>5. Trust & Guarantee</h4><p>We guarantee to process all redemptions on time. Your money is fully secured by an unchangeable smart contract. This means no one, not even our team, can touch or run away with your funds. It is 100% safe on-chain.</p></div>
                <div className="rule-block"><h4>6. Wallet Display Note</h4><p>UFO tokens may not display a value in your wallet because it is a fund tool, not a traditional cryptocurrency. However, this does not affect its actual underlying value.</p></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
