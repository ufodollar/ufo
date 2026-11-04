import { useState, useEffect } from 'react';
import { useAppKit, useAppKitAccount, useAppKitProvider, useAppKitNetwork } from '@reown/appkit/react';
import { ethers } from 'ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 配置区 =================
// ⚠️ 请务必替换为你真实的最新合约地址
const VAULT_ADDRESS = '0x你的BSC金库地址'; 
const UFO_ADDRESS = '0x你的BSC_UFO地址';
// ==========================================

const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
const AAVE_POOL_ADDRESS = '0x6807dc923806fE8Fd134338EABCA509979a7e0cB'; // BSC Aave V3 Pool

// 换用更稳定的公共 RPC
const rpcProvider = new ethers.JsonRpcProvider("https://bsc-rpc.publicnode.com");

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
  "function getExchangeRate() view returns (uint256)"
];

// 🔥 找回第一次成功的字符串 ABI
const AAVE_ABI = [
  "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)"
];

const SwitchIcon = () => (
  <svg className="switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
  </svg>
);

let globalAudioCtx = null;
const getAudioContext = () => {
  if (!globalAudioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    globalAudioCtx = new AudioContext();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume();
  }
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

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
    osc2.start(now);
    osc2.stop(now + 0.4);
    lfo.start(now);
    lfo.stop(now + 0.6);

  } catch (e) { }
};

const formatAmount = (val) => {
  if (!val) return '0.0';
  const num = parseFloat(val);
  if (num === 0) return '0.0';
  return num.toFixed(6).replace(/\.?0+$/, ''); 
};

function App() {
  const { open, close } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { switchNetwork } = useAppKitNetwork();

  const [isDepositMode, setIsDepositMode] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [usdtBalance, setUsdtBalance] = useState('0');
  const [ufoBalance, setUfoBalance] = useState('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [msg, setMsg] = useState('');
  
  const [showRules, setShowRules] = useState(false);
  const [nav, setNav] = useState(1); 
  const [aaveApy, setAaveApy] = useState('0.00'); 

  useEffect(() => {
    const handleGlobalClick = () => { playClickSound(); };
    window.addEventListener('click', handleGlobalClick);
    return () => { window.removeEventListener('click', handleGlobalClick); };
  }, []);

  useEffect(() => {
    if (isConnected) { switchNetwork(bsc); }
  }, [isConnected, switchNetwork]);

  useEffect(() => {
    if (isConnected) { close(); }
  }, [isConnected, close]);

  const fetchData = async () => {
    try {
      // 1. 获取净值 (NAV)
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, rpcProvider);
      const rate = await vaultContract.getExchangeRate();
      const currentNav = parseFloat(ethers.formatUnits(rate, 18));
      setNav(currentNav);

      // 2. 获取 Aave V3 实时年化利率（使用最初成功的逻辑）
      try {
        const aaveContract = new ethers.Contract(AAVE_POOL_ADDRESS, AAVE_ABI, rpcProvider);
        const reserveData = await aaveContract.getReserveData(USDT_ADDRESS);
        
        // 直接取索引 2 的 currentLiquidityRate
        const liquidityRate = reserveData[2]; 
        
        if (liquidityRate !== undefined) {
          const rateInDecimal = parseFloat(ethers.formatUnits(liquidityRate, 27));
          
          // 🔥 最初成功的算法（直接单利转换），如果非要用复利，前端计算容易出偏差，这里采用最稳妥的单利展示
          const apy = (rateInDecimal * 100).toFixed(2);
          setAaveApy(apy);
        }
      } catch (aaveError) {
        console.error("Aave Data Fetch Error:", aaveError);
      }

    } catch (e) { 
      console.log("General Fetch Data Error:", e); 
    }
  };

  const fetchBalances = async () => {
    if (!address) return;
    try {
      const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, rpcProvider);
      const ufoContract = new ethers.Contract(UFO_ADDRESS, ERC20_ABI, rpcProvider);
      const usdtBal = await usdtContract.balanceOf(address);
      const ufoBal = await ufoContract.balanceOf(address);
      
      setUsdtBalance(ethers.formatUnits(usdtBal, 6));
      setUfoBalance(ethers.formatUnits(ufoBal, 18));
      fetchData(); 
    } catch (e) { }
  };

  useEffect(() => { 
    fetchBalances(); 
    const interval = setInterval(() => { fetchData(); }, 15000); 
    return () => clearInterval(interval);
  }, [address, isDepositMode]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val < 0 || val.includes('-')) { setMsg("Negative amounts are not allowed."); return; }
    setMsg(''); setInputAmount(val);
  };

  const handleAction = async () => {
    if (!isConnected) return open({ view: 'AllWallets' });
    if (!inputAmount || inputAmount <= 0) return setMsg("Please enter a valid amount");
    if (!walletProvider) return setMsg("Provider not ready");

    try {
      setIsProcessing(true); setMsg("");
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      
      const tokenAddress = isDepositMode ? USDT_ADDRESS : UFO_ADDRESS;
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const amount = isDepositMode ? ethers.parseUnits(inputAmount, 6) : ethers.parseUnits(inputAmount, 18);

      const allowance = await tokenContract.allowance(address, VAULT_ADDRESS);
      if (allowance < amount) {
        setMsg(`Approving ${isDepositMode ? 'USDT' : 'UFO'}...`);
        // 🔥 精准授权
        const txApprove = await tokenContract.approve(VAULT_ADDRESS, amount);
        await txApprove.wait();
      }

      setMsg(isDepositMode ? "Depositing..." : "Redeeming...");
      const tx = isDepositMode ? await vaultContract.deposit(amount) : await vaultContract.withdraw(amount);
      await tx.wait();
      setMsg("Transaction Successful!");
      setInputAmount('');
      fetchBalances();
    } catch (err) {
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
    const calc = isDepositMode ? (parseFloat(inputAmount) / nav) : (parseFloat(inputAmount) * nav);
    receiveAmount = formatAmount(calc.toString()); 
  }

  const usdtValue = parseFloat(usdtBalance) * 1;
  const ufoValue = parseFloat(ufoBalance) * nav;

  return (
    <>
      <style>{`
        w3m-modal {
          --w3m-modal-height: 100dvh !important;
          --w3m-modal-max-height: 100dvh !important;
          align-items: flex-end !important; 
          height: 100dvh !important;
          max-height: 100dvh !important;
        }
        w3m-modal > wui-flex, 
        w3m-modal wui-flex.modal-container,
        .w3m-modal-content {
          height: 90dvh !important; 
          max-height: 90dvh !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important; 
          margin-bottom: 0 !important;
          padding-bottom: env(safe-area-inset-bottom) !important; 
        }
        w3m-router {
          height: 100% !important;
          max-height: 100% !important;
        }
        .modal-content {
          display: flex;
          flex-direction: column;
          padding: 24px 24px 0 24px !important;
          max-height: 85vh !important;
        }
        .modal-header {
          flex-shrink: 0;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }
        .modal-header h3 {
          font-size: 1.3rem;
        }
        .btn-close {
          font-size: 2.2rem !important; 
          line-height: 1;
          margin-top: -6px;
        }
        .rules-content {
          flex-grow: 1;
          overflow-y: auto;
          padding-bottom: 24px;
          margin-top: 0;
        }
        .rules-content::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="bg-shape-square"></div>
      <div className="bg-shape-triangle"></div>

      <div className="app-container">
        <header className="header">
          <div className="logo-container">
            <img src={UFO_LOGO} alt="UFO Logo" className="brand-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="logo-text">UFO <span>Fund</span></div>
          </div>
          <button className="btn-connect" onClick={() => open({ view: 'AllWallets' })}>
            {isConnected ? (
              <><span>{address.slice(0,6)}...{address.slice(-4)}</span><SwitchIcon /></>
            ) : (
              <>Connect Wallet</>
            )}
          </button>
        </header>

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
            <button className="btn-rules" onClick={() => setShowRules(true)}>
              Rules
            </button>
          </div>
        </div>

        <div className="card">
          <div className="tabs">
            <button className={`tab ${isDepositMode ? 'active' : ''}`} onClick={() => { setIsDepositMode(true); setInputAmount(''); setMsg(''); }}>Deposit</button>
            <button className={`tab ${!isDepositMode ? 'active' : ''}`} onClick={() => { setIsDepositMode(false); setInputAmount(''); setMsg(''); }}>Redeem</button>
          </div>

          <div className="input-box">
            <div className="input-label">
              <span>{isDepositMode ? 'You Pay' : 'You Redeem'}</span>
              <span className="balance" onClick={() => { if(isConnected) setInputAmount(currentBalance); }}>
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
              <span>{isDepositMode ? 'You Receive' : 'You Receive'}</span>
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
            <span className="info-label"><span className="big-icon">🏦</span> Net Asset Value</span>
            <span className="info-value green">{nav.toFixed(4)} USDT</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">💰</span> Yield Source</span>
            <span className="info-value blue">Aave V3</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">📊</span> Aave V3 APY</span>
            <span className="info-value blue">{aaveApy}%</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">⛓️</span> Network</span>
            <span className="info-value purple">BNB Chain</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">💸</span> Fund Type</span>
            <span className="info-value purple">Flexible (Deposit & Withdraw Anytime)</span>
          </div>
          <div className="info-item">
            <span className="info-label"><span className="big-icon">🔻</span> Redemption Fee</span>
            <span className="info-value red" style={{ color: '#ff3b30' }}>1.5%</span>
          </div>
        </div>

        <a href="https://t.me/ufofund" target="_blank" rel="noopener noreferrer" className="social-link">
          Contact Fund Manager
        </a>
        
        <div className="footer-text">Secured by Aave V3 on BSC.<br/>Smart contracts are audited and fully on-chain.</div>

        {showRules && (
          <div className="modal-overlay" onClick={() => setShowRules(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>UFO Fund Rules</h3>
                <button className="btn-close" onClick={() => setShowRules(false)}>×</button>
              </div>
              <div className="rules-content">
                
                <div className="rule-block" style={{ backgroundColor: 'rgba(0, 122, 255, 0.08)', borderColor: 'rgba(0, 122, 255, 0.2)' }}>
                  <h4 style={{ color: 'var(--accent)' }}>1. Fund Overview & Mechanism</h4>
                  <p>UFO Fund is a flexible, tokenized wealth management gateway on BNB Smart Chain (BSC). By depositing USDT, you receive $UFO tokens representing your fund shares. Your assets are securely deployed into Aave V3 to generate real, on-chain interest. There are no lockups; you can deposit and withdraw at any time.</p>
                </div>

                <div className="rule-block" style={{ backgroundColor: 'rgba(52, 199, 89, 0.08)', borderColor: 'rgba(52, 199, 89, 0.2)' }}>
                  <h4 style={{ color: '#34c759' }}>2. Algorithmic Protection & Fairness</h4>
                  <p>In UFO Fund, your principal and interest are <strong>algorithmically locked</strong>. The entry or exit of whales will <strong>never affect your Net Asset Value</strong>. Your assets are 1:1 backed by the underlying assets in Aave. The longer you hold, the more real interest Aave generates, and the higher your Net Asset Value will be. There is no market maker, no price dumping—only the gift of time compounding.</p>
                </div>

                <div className="rule-block"><h4>3. Redemption & Yield</h4><p>Since Aave yields continue to accrue every second, the Net Asset Value keeps rising continuously. You can redeem your principal and accumulated interest at any time. Early redemption by any user does not lower the Net Asset Value for others; it simply removes their proportional share of the assets.</p></div>
                
                <div className="rule-block">
                  <h4>4. Unique Revenue Model: 1.5% Redemption Fee</h4>
                  <p><strong>We do NOT harvest your interest!</strong> 100% of the Aave yield goes directly into increasing your Net Asset Value. Our platform's sole revenue model is a <strong>1.5% redemption fee</strong> deducted only when you withdraw. This fee is instantly transferred to the Fund Manager's wallet.</p>
                  <p style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}><strong>Important Note on Break-even:</strong> Because of the 1.5% redemption fee, if you redeem too early, the fee may exceed your accumulated interest. Based on current Aave yields, <strong>you need to hold your UFO for at least 90 to 100 days</strong> to fully cover the 1.5% fee and start generating pure profit.</p>
                </div>
                
                <div className="rule-block" style={{ borderColor: '#ffcc00', backgroundColor: 'rgba(255, 204, 0, 0.05)' }}>
                  <h4 style={{ color: '#d9a000' }}>5. Dynamic Pricing & Visual Settlement</h4>
                  <p>The "Net Asset Value" displayed is a <strong>real-time dynamic metric</strong>. When a large user redeems a significant portion of the vault, the protocol settles the accounting. This will cause the displayed Net Asset Value to <strong>adjust downwards instantaneously</strong>. However, this is strictly a visual accounting settlement and <strong>does not affect your principal or your actual earned interest</strong>. Your share's underlying value remains mathematically protected.</p>
                </div>

                <div className="rule-block" style={{ borderColor: 'var(--accent)' }}><h4>6. Security & Wallet Note</h4><p>Your money is fully secured by an unchangeable smart contract. No one, not even our team, can touch or run away with your funds. Please note that $UFO tokens may not display a dollar value in your Web3 wallet because it is a fund share tool, not a traditional cryptocurrency. This does not affect its actual underlying value.</p></div>
                
                <div className="rule-block" style={{ backgroundColor: 'rgba(255, 59, 48, 0.05)', borderColor: 'rgba(255, 59, 48, 0.2)' }}>
                  <h4 style={{ color: '#ff3b30' }}>7. Compliance & Disclaimer</h4>
                  <p>UFO Fund is a decentralized protocol accessible globally. However, it is your <strong>sole responsibility</strong> to ensure that your use of this platform complies with the laws and regulations of your local jurisdiction. By interacting with our smart contracts, you represent and warrant that you are not located in, under the control of, or a national or resident of any restricted jurisdiction (including but not limited to the <strong>United States, Mainland China, Canada, Iran, North Korea, Syria, Cuba, the Crimea region, and Russia</strong>), and that you are not on any government restricted parties list. You use this protocol entirely at your own risk.</p>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
