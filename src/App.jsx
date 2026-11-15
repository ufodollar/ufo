import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, useAppKitProvider, createAppKit, AppKitButton } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. Web3 & 合约配置 =================
const CONFIG = {
  VAULT_ADDRESS: '0x62Eaf08612c77F944265DE421F3Bed054531cC9C', 
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  FEE_RATE: 0.005,
};

const STABLECOINS = [
  { symbol: 'USDT', name: 'Tether USD', address: CONFIG.USDT_ADDRESS, icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
  { symbol: 'USDC', name: 'USD Coin', address: CONFIG.USDC_ADDRESS, icon: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png' }
];

const UFO_TOKEN = { symbol: 'UFO', name: 'UFO Dollar', address: CONFIG.UFO_ADDRESS, icon: 'UFO' };

const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)", 
  "function allowance(address owner, address spender) view returns (uint256)", 
  "function approve(address spender, uint256 amount) returns (bool)"
];

const VAULT_ABI = [
  "function deposit(address tokenAddress, uint256 amount)", 
  "function withdraw(address tokenAddress, uint256 ufoAmount)", 
  "function getExchangeRate() view returns (uint256)"
];

const ORACLE_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

// ================= 2. Reown AppKit 初始化 =================
try {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    metadata: { 
      name: 'UFO Dollar', 
      description: 'Value-Invisible Settlement Stablecoin', 
      url: window.location.origin,
      icons: ['https://ufo-eea.pages.dev/favicon.ico'],
      redirect: { native: 'https://ufo-eea.pages.dev', universal: 'https://ufo-eea.pages.dev', linkMode: true },
    },
    projectId: 'd6431212399f6c487b364387859983ea',
    features: { analytics: true, allWallets: { showWallets: true } },
    featuredWalletIds: ['a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393'],
    enableWalletConnect: true, 
    enableInjected: true,
  });
} catch (e) { console.error("AppKit Init Error:", e); }

// ================= 3. 全局样式与图标 =================
const FONT_STYLE = {
  fontFamily: '"Lora", "Noto Serif SC", "Songti SC", Georgia, "Times New Roman", serif'
};

const UfoIcon = ({ size = 36 }) => (
  <svg viewBox="0 0 100 100" style={{ width: size, height: size }} xmlns="http://www.w3.org/2000/svg">
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
    <path d="M 25 52 C 25 15, 75 15, 75 52 Z" fill="url(#ufo-glass)" stroke="#3b82f6" strokeWidth="3" />
    <ellipse cx="50" cy="55" rx="45" ry="16" fill="url(#ufo-body)" />
    <circle cx="35" cy="55" r="4" fill="#fff" />
    <circle cx="50" cy="57" r="4" fill="#fff" />
    <circle cx="65" cy="55" r="4" fill="#fff" />
  </svg>
);

const RuleIcon = ({ type }) => {
  const icons = {
    globe: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    safe: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>,
    shield: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    eye: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    layers: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    zap: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    lock: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    alert: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  };
  return icons[type] || null;
};

const CardHeader = ({ title, iconType }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
    <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: '6px' }}>{title}</div>
    <div style={{ color: 'rgba(255,255,255,0.8)' }}><RuleIcon type={iconType} /></div>
  </div>
);

// ================= 4. 主应用组件 =================
function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  const [activeTab, setActiveTab] = useState('swap');
  const [isBuyingUFO, setIsBuyingUFO] = useState(true);
  
  const [selectedStablecoin, setSelectedStablecoin] = useState(STABLECOINS[0]);
  const [showTokenMenu, setShowTokenMenu] = useState(false);
  
  const [vaultBalances, setVaultBalances] = useState({ USDT: 0, USDC: 0 });

  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('0.000000');
  const [feeAmount, setFeeAmount] = useState('0.000000');
  
  const [currentNav, setCurrentNav] = useState(1);
  const [bnbPrice, setBnbPrice] = useState(600);
  
  const [bnbBal, setBnbBal] = useState('0.000000');
  const [tokenBalances, setTokenBalances] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [txMsg, setTxMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('ufo_tx_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveTxToHistory = (txRecord) => {
    const newHistory = [txRecord, ...history].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem('ufo_tx_history', JSON.stringify(newHistory));
  };

  const ensureBscNetwork = useCallback(async () => {
    if (!walletProvider) return false;
    try {
      await walletProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
      return true;
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await walletProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{ chainId: '0x38', chainName: 'BNB Smart Chain', nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }, rpcUrls: ['https://bsc-dataseed.binance.org'], blockExplorerUrls: ['https://bscscan.com/'] }],
          });
          return true;
        } catch (addError) { return false; }
      }
      return false;
    }
  }, [walletProvider]);

  useEffect(() => {
    if (isConnected && walletProvider) ensureBscNetwork();
  }, [isConnected, walletProvider, ensureBscNetwork]);

  useEffect(() => {
    const fetchNav = async () => {
      try {
        const vault = new ethers.Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, rpcProvider);
        const rate = await vault.getExchangeRate();
        setCurrentNav(parseFloat(ethers.formatUnits(rate, 18)));
      } catch (error) {}
    };
    fetchNav();
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!address || !walletProvider) return;
    try {
      const browserProvider = new ethers.BrowserProvider(walletProvider);
      const bnbBalanceWei = await browserProvider.getBalance(address);
      setBnbBal(parseFloat(ethers.formatEther(bnbBalanceWei)).toFixed(6));

      const oracleContract = new ethers.Contract(CONFIG.BNB_ORACLE, ORACLE_ABI, rpcProvider);
      const priceData = await oracleContract.latestRoundData();
      setBnbPrice(parseFloat(ethers.formatUnits(priceData.answer, 8)));

      const allTokens = [...STABLECOINS, UFO_TOKEN];
      const promises = allTokens.map(token => {
        const contract = new ethers.Contract(token.address, ERC20_ABI, rpcProvider);
        return contract.balanceOf(address);
      });
      
      const results = await Promise.allSettled(promises);
      const newBalances = {};
      results.forEach((res, index) => {
        const token = allTokens[index];
        newBalances[token.symbol] = res.status === 'fulfilled' 
          ? parseFloat(ethers.formatUnits(res.value, 18)).toFixed(6)
          : '0.000000';
      });
      setTokenBalances(newBalances);

      const vaultUsdtContract = new ethers.Contract(CONFIG.USDT_ADDRESS, ERC20_ABI, rpcProvider);
      const vaultUsdcContract = new ethers.Contract(CONFIG.USDC_ADDRESS, ERC20_ABI, rpcProvider);
      
      const [vUsdt, vUsdc] = await Promise.all([
        vaultUsdtContract.balanceOf(CONFIG.VAULT_ADDRESS),
        vaultUsdcContract.balanceOf(CONFIG.VAULT_ADDRESS)
      ]);
      
      setVaultBalances({
        USDT: parseFloat(ethers.formatUnits(vUsdt, 18)),
        USDC: parseFloat(ethers.formatUnits(vUsdc, 18))
      });

    } catch (error) {
      console.error("Failed to fetch balances:", error);
    }
  }, [address, walletProvider]);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalances();
      const interval = setInterval(fetchBalances, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address, activeTab, fetchBalances]);

  useEffect(() => {
    const input = parseFloat(inputAmount);
    if (isNaN(input) || input <= 0 || !isFinite(input)) {
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      setErrorMsg('');
      return;
    }

    const fee = input * CONFIG.FEE_RATE;
    const netAmount = input - fee;
    setFeeAmount(fee.toFixed(6));
    setOutputAmount(netAmount.toFixed(6));
    
    if (!isBuyingUFO) {
      const currentVaultBal = vaultBalances[selectedStablecoin.symbol] || 0;
      if (netAmount > currentVaultBal) {
        setErrorMsg(`Insufficient ${selectedStablecoin.symbol} in Vault. Available: ${currentVaultBal.toFixed(2)}`);
        return;
      }
    }

    const currentBal = parseFloat(tokenBalances[isBuyingUFO ? selectedStablecoin.symbol : 'UFO'] || '0');
    if (isConnected && input > currentBal) {
      setErrorMsg(`Insufficient ${isBuyingUFO ? selectedStablecoin.symbol : 'UFO'} balance`);
    } else {
      setErrorMsg('');
    }
  }, [inputAmount, isBuyingUFO, tokenBalances, isConnected, selectedStablecoin, vaultBalances]);

  const handleAction = async () => {
    if (isProcessing) return;
    if (!isConnected || !walletProvider) return open({ view: 'AllWallets' });
    
    const isNetworkOk = await ensureBscNetwork();
    if (!isNetworkOk) return;

    const input = parseFloat(inputAmount);
    if (!inputAmount || input <= 0 || isNaN(input) || errorMsg) return;

    setIsProcessing(true);
    setTxMsg('');
    setErrorMsg('');

    const currentTime = new Date().toLocaleString();
    const txRecord = {
      time: currentTime,
      type: isBuyingUFO ? 'Swap' : 'Redeem',
      payAmount: inputAmount,
      paySymbol: isBuyingUFO ? selectedStablecoin.symbol : 'UFO',
      receiveAmount: outputAmount,
      receiveSymbol: isBuyingUFO ? 'UFO' : selectedStablecoin.symbol,
      status: 'Pending',
      txHash: ''
    };

    try {
      const provider = new ethers.BrowserProvider(walletProvider);
      const bnbBalance = await provider.getBalance(address);
      if (parseFloat(ethers.formatEther(bnbBalance)) < 0.0005) throw new Error(`Insufficient BNB for gas.`);

      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, signer);

      if (isBuyingUFO) {
        const rawAmount = ethers.parseUnits(inputAmount, 18);
        const tokenContract = new ethers.Contract(selectedStablecoin.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(address, CONFIG.VAULT_ADDRESS);
        if (allowance < rawAmount) {
          setTxMsg(`Approving ${selectedStablecoin.symbol}...`);
          const txApprove = await tokenContract.approve(CONFIG.VAULT_ADDRESS, ethers.MaxUint256);
          await txApprove.wait();
        }
        setTxMsg('Swapping...');
        const tx = await vault.deposit(selectedStablecoin.address, rawAmount);
        await tx.wait();
        setTxMsg('Swap Successful!');
        
        txRecord.status = 'Success';
        txRecord.txHash = tx.hash;
        saveTxToHistory(txRecord);

      } else {
        const rawAmount = ethers.parseUnits(inputAmount, 18);
        setTxMsg('Redeeming...');
        const tx = await vault.withdraw(selectedStablecoin.address, rawAmount);
        await tx.wait();
        setTxMsg('Redeem Successful!');
        
        txRecord.status = 'Success';
        txRecord.txHash = tx.hash;
        saveTxToHistory(txRecord);
      }

      setInputAmount(''); setOutputAmount('0.000000'); setFeeAmount('0.000000'); fetchBalances();
    } catch (error) {
      setErrorMsg(error.reason || error.shortMessage || error.message || 'Transaction failed');
      txRecord.status = 'Failed';
      txRecord.txHash = '-';
      saveTxToHistory(txRecord);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all local history?")) {
      localStorage.removeItem('ufo_tx_history');
      setHistory([]);
    }
  };

  const formatUsd = (val) => Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isButtonDisabled = isProcessing || (isConnected && (errorMsg !== '' || !inputAmount || parseFloat(inputAmount) <= 0));

  return (
    <div style={{ ...FONT_STYLE, display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      
      <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '250px', height: '250px', background: '#bfdbfe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '50px', right: '-50px', width: '250px', height: '250px', background: '#ddd6fe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <UfoIcon size={28} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>UFO<span style={{ color: '#3b82f6' }}> Dollar</span></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {isConnected ? <AppKitButton balance="hide" /> : (
            <button onClick={() => open({ view: 'AllWallets' })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 85px 20px', zIndex: 10 }}>
        
        {activeTab === 'swap' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Swap</h3>
            
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Pay</span>
                <span>Balance: {isConnected ? (isBuyingUFO ? tokenBalances[selectedStablecoin.symbol] : tokenBalances['UFO']) || '0.0' : '0.000000'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} placeholder="0.000000" style={{ ...FONT_STYLE, background: 'transparent', border: 'none', outline: 'none', fontSize: '28px', fontWeight: '700', color: '#1e293b', width: '100%' }} />
                
                <div 
                  onClick={() => { if (isBuyingUFO) setShowTokenMenu(!showTokenMenu); }}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: isBuyingUFO ? 'pointer' : 'default' }}
                >
                  {isBuyingUFO ? (
                    <><img src={selectedStablecoin.icon} style={{width: 24, height: 24}} alt={selectedStablecoin.symbol}/><span>{selectedStablecoin.symbol}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg></>
                  ) : (
                    <><UfoIcon size={28}/><span>UFO</span></>
                  )}

                  {showTokenMenu && isBuyingUFO && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 100, overflow: 'hidden' }}>
                      {STABLECOINS.map(coin => (
                        <div key={coin.symbol} onClick={(e) => { e.stopPropagation(); setSelectedStablecoin(coin); setShowTokenMenu(false); setInputAmount(''); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                          <img src={coin.icon} style={{width: 20, height: 20}} alt={coin.symbol}/>
                          <span style={{ fontSize: '14px', color: '#1e293b' }}>{coin.symbol}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600', marginTop: '8px' }}>{errorMsg}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '-18px 0', position: 'relative', zIndex: 10 }}>
              <button onClick={() => { setIsBuyingUFO(!isBuyingUFO); setInputAmount(''); setTxMsg(''); setErrorMsg(''); }} disabled={isProcessing} style={{ background: '#fff', border: '4px solid #f8fafc', width: '48px', height: '48px', borderRadius: '50%', color: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isProcessing ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.1)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20V4" /><path d="M3 8l4-4 4 4" /><path d="M17 4v16" /><path d="M21 16l-4 4-4-4" /></svg>
              </button>
            </div>

            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Receive (Estimated)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ ...FONT_STYLE, fontSize: '28px', fontWeight: '700', color: '#3b82f6' }}>{outputAmount}</div>
                
                <div 
                  onClick={() => { if (!isBuyingUFO) setShowTokenMenu(!showTokenMenu); }}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: !isBuyingUFO ? 'pointer' : 'default' }}
                >
                  {isBuyingUFO ? (
                    <><UfoIcon size={28}/><span>UFO</span></>
                  ) : (
                    <><img src={selectedStablecoin.icon} style={{width: 24, height: 24}} alt={selectedStablecoin.symbol}/><span>{selectedStablecoin.symbol}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg></>
                  )}

                  {showTokenMenu && !isBuyingUFO && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 100, overflow: 'hidden' }}>
                      {STABLECOINS.map(coin => (
                        <div key={coin.symbol} onClick={(e) => { e.stopPropagation(); setSelectedStablecoin(coin); setShowTokenMenu(false); setInputAmount(''); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                          <img src={coin.icon} style={{width: 20, height: 20}} alt={coin.symbol}/>
                          <span style={{ fontSize: '14px', color: '#1e293b' }}>{coin.symbol}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
                            Pool: {vaultBalances[coin.symbol].toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {!isBuyingUFO && parseFloat(inputAmount) > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', fontSize: '13px', color: '#64748b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>USDT Pool:</span>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{vaultBalances.USDT.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>USDC Pool:</span>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{vaultBalances.USDC.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px', background: '#f8fafc', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                <span>Rate</span>
                <span>1 UFO = ${currentNav} USD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', marginBottom: '6px' }}>
                <span>Protocol Fee (0.5%)</span>
                {/* 🔥 修复：统一显示为 USD */}
                <span>-{feeAmount} USD</span>
              </div>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700' }}>
                <span>Net Received</span>
                <span>{outputAmount} {isBuyingUFO ? 'UFO' : selectedStablecoin.symbol}</span>
              </div>
            </div>

            {txMsg && (
              <div style={{ marginTop: '15px', padding: '10px', textAlign: 'center', background: txMsg.includes('Successful') ? '#ecfdf5' : '#eff6ff', color: txMsg.includes('Successful') ? '#10b981' : '#3b82f6', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>{txMsg}</div>
            )}

            <button onClick={handleAction} disabled={isButtonDisabled} style={{ ...FONT_STYLE, width: '100%', padding: '16px', background: isButtonDisabled ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: isButtonDisabled ? 'not-allowed' : 'pointer', marginTop: '20px', boxShadow: isButtonDisabled ? 'none' : '0 8px 20px -5px rgba(59,130,246,0.4)' }}>
              {isProcessing ? 'Processing...' : (isConnected ? (isBuyingUFO ? 'Swap Now' : 'Redeem Now') : 'Connect Wallet')}
            </button>
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="https://cryptologos.cc/logos/bnb-bnb-logo.png" style={{width: 40, height: 40}} alt="BNB"/>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '16px', fontWeight: '700' }}>BNB</span><span style={{ fontSize: '12px', color: '#64748b' }}>Gas Fee Token</span></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? bnbBal : '0.000000'}</span>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace' }}>≈ ${formatUsd(Number(bnbBal) * bnbPrice)}</span>
              </div>
            </div>
            {[...STABLECOINS, UFO_TOKEN].map((token, index, arr) => (
              <div key={token.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: index !== arr.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: index !== arr.length - 1 ? '20px' : '0', marginBottom: index !== arr.length - 1 ? '20px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {token.icon === 'UFO' ? <div style={{width: 40, height: 40, background: '#f8fafc', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}><UfoIcon size={28}/></div> : <img src={token.icon} style={{width: 40, height: 40}} alt={token.symbol}/>}
                  <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '16px', fontWeight: '700' }}>{token.symbol}</span><span style={{ fontSize: '12px', color: '#64748b' }}>{token.name}</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? tokenBalances[token.symbol] || '0.000000' : '0.000000'}</span>
                  <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace' }}>≈ ${formatUsd(Number(tokenBalances[token.symbol] || 0))}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Transaction History</h3>
              {history.length > 0 && (
                <button onClick={clearHistory} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px auto' }}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p style={{ fontSize: '14px' }}>No transaction history found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((tx, idx) => (
                  <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: tx.type === 'Swap' ? '#3b82f6' : '#8b5cf6' }}>
                          {tx.type}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{tx.time}</span>
                      </div>
                      <span style={{ 
                        fontSize: '12px', fontWeight: '700', 
                        color: tx.status === 'Success' ? '#10b981' : (tx.status === 'Failed' ? '#ef4444' : '#f59e0b'),
                        background: tx.status === 'Success' ? '#ecfdf5' : (tx.status === 'Failed' ? '#fef2f2' : '#fffbeb'),
                        padding: '2px 8px', borderRadius: '10px'
                      }}>
                        {tx.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                      <div>
                        Paid: <span style={{ fontWeight: '600', color: '#1e293b' }}>{tx.payAmount} {tx.paySymbol}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        Received: <span style={{ fontWeight: '600', color: '#1e293b' }}>{tx.receiveAmount} {tx.receiveSymbol}</span>
                      </div>
                    </div>
                    {tx.txHash && tx.txHash !== '-' && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all' }}>
                        TxHash: {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            {/* 1. 核心定位与最大卖点 */}
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,58,138,0.3)' }}>
              <CardHeader title="The Value-Invisible Stablecoin" iconType="eye" />
              <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px' }}>Transparent on-chain. Invisible in your wallet.</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is a USD-pegged stablecoin engineered for absolute asset protection and confidential B2B settlement. By avoiding public exchange listings, standard wallets display its fiat value as <b>$0.00</b>. This acts as a powerful physical camouflage against extortion and automated wallet-draining bots.</p>
            </div>

            {/* 2. 流通隐私 */}
            <div style={{ background: 'linear-gradient(135deg, #1e293b, #475569)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,41,59,0.3)' }}>
              <CardHeader title="Private Circulation" iconType="lock" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Confidential Settlement & Zero Trace.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Operating as a closed-loop network with no public DEX liquidity pools, UFO isolates your transactions from public trackers. Enterprises can settle cross-border trades and payroll without exposing commercial data to on-chain analysts.</p>
            </div>

            {/* 3. 双池隔离防御 */}
            <div style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(15,118,110,0.3)' }}>
              <CardHeader title="Dual-Collateral Isolation" iconType="safe" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Resilient against systemic freezing.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>The Vault accepts both <b>USDT and USDC</b>, holding them in strictly isolated pools. If one stablecoin issuer faces regulatory blacklisting, the other pool remains fully operational, ensuring merchants always have a redemption path.</p>
            </div>

            {/* 4. 刚性兑付 */}
            <div style={{ background: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(76,29,149,0.3)' }}>
              <CardHeader title="Strict 1:1 Peg" iconType="shield" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Zero Slippage. Oracle-Free.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Mint and redeem at a rigid 1:1 ratio. There are no AMM curves, no liquidity slippage, and no external price oracles to manipulate. What you deposit is exactly what you can withdraw.</p>
            </div>

            {/* 5. 结算速度 */}
            <div style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(180,83,9,0.3)' }}>
              <CardHeader title="Instant Settlement" iconType="zap" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>24/7 Global Fund Clearing.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Send money like a message. With UFO, cross-border funds arrive in the recipient's wallet within seconds, bypassing traditional banking delays and operating non-stop every day of the year.</p>
            </div>

            {/* 6. 合规与安全 */}
            <div style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(67,56,202,0.3)' }}>
              <CardHeader title="Security & Compliance" iconType="layers" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Cryptographically tamper-proof.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>While vault reserves are 100% transparent and verifiable on BscScan, user transaction flows are isolated from public pools. Every transaction is secured by blockchain-level cryptography, ensuring absolute asset integrity.</p>
            </div>

            {/* 7. 免责声明 */}
            <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #ef4444)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(127,29,29,0.3)' }}>
              <CardHeader title="Disclaimer" iconType="alert" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>A payment instrument, not an investment.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO does not offer yields or speculative returns. Users are solely responsible for ensuring their use of the protocol complies with local laws. UFO is not offered to persons in restricted jurisdictions including the <b>United States, Mainland China, Iran, North Korea, Syria, Cuba, Venezuela, Russia, and Belarus</b>.</p>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Connect with Us</h2>
            <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '40px', maxWidth: '300px' }}>Follow our official channels for updates and institutional onboarding.</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '40px' }}>
              <a href="https://x.com/ufodollar" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ width: '72px', height: '72px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0', transition: 'background 0.2s' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#000000"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
                </div>
              </a>
              <a href="https://t.me/ufodollar" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ width: '72px', height: '72px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0', transition: 'background 0.2s' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#000000"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
                </div>
              </a>
              <a href="https://youtube.com/@ufodollar" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ width: '72px', height: '72px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0', transition: 'background 0.2s' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="#000000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </div>
              </a>
            </div>

            <div style={{ marginBottom: '32px', fontSize: '12px', color: '#94a3b8', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>UFO built by StoneX</div>

            <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <a href="mailto:ufodollar6@gmail.com" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </div>
                  <div><div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Email Support</div><div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>ufodollar6@gmail.com</div></div>
                </div>
              </a>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div><div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Headquarters</div><div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', lineHeight: 1.4 }}>Ritter House, Wickhams Cay 2,<br/>Road Town, Tortola, BVI</div></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ 
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
        background: '#ffffff', borderTop: '1px solid #e2e8f0', 
        padding: '8px 0 16px 0', zIndex: 20 
      }}>
        {[
          { id: 'swap', label: 'Swap', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg> },
          { id: 'assets', label: 'Wallet', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg> },
          { id: 'history', label: 'History', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
          { id: 'rules', label: 'Rules', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> },
          { id: 'contact', label: 'Contact', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> }
        ].map((tab) => (
          <div 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', 
              color: activeTab === tab.id ? '#0969da' : '#57606a', 
              flex: 1, cursor: 'pointer',
            }}
          >
            <div style={{ transform: activeTab === tab.id ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}>
              {tab.icon}
            </div>
            <span style={{ fontSize: '10px', fontWeight: activeTab === tab.id ? '600' : '500' }}>{tab.label}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  container.innerHTML = '';
  createRoot(container).render(<App />);
}