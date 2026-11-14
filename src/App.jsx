import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, useAppKitProvider, createAppKit, AppKitButton } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. Web3 & 合约配置 =================
const CONFIG = {
  VAULT_ADDRESS: '0x16fBa21bB5c35A8D67118b38259329AA814ED0DE', // 请替换为你最新部署的 Vault 地址
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  FEE_RATE: 0.005,
};

const TOKENS = [
  { symbol: 'USDT', name: 'Tether USD', address: CONFIG.USDT_ADDRESS, decimals: 18, icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
  { symbol: 'UFO', name: 'UFO Dollar', address: CONFIG.UFO_ADDRESS, decimals: 18, icon: 'UFO' }
];

const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org");

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)", 
  "function allowance(address owner, address spender) view returns (uint256)", 
  "function approve(address spender, uint256 amount) returns (bool)"
];
const VAULT_ABI = [
  "function deposit(uint256 usdtAmount)", 
  "function withdraw(uint256 ufoAmount)", 
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
      description: 'Universal Crypto Settlement Stablecoin', 
      url: window.location.origin,
      icons: ['https://ufo-eea.pages.dev/favicon.ico'],
    },
    projectId: 'd6431212399f6c487b364387859983ea',
    features: { analytics: true, allWallets: { showWallets: true } },
  });
} catch (e) { console.error(e); }

// ================= 3. 全局样式与图标 =================
const FONT_STYLE = {
  fontFamily: '"Lora", "Noto Serif SC", "Songti SC", Georgia, "Times New Roman", serif'
};

const UfoIcon = ({ size = 36 }) => (
  <svg viewBox="0 0 100 100" style={{ width: size, height: size }} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ufo-body" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient>
      <linearGradient id="ufo-glass" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#e0f2fe" /><stop offset="100%" stopColor="#bae6fd" /></linearGradient>
    </defs>
    <path d="M 25 52 C 25 15, 75 15, 75 52 Z" fill="url(#ufo-glass)" stroke="#3b82f6" strokeWidth="3" />
    <ellipse cx="50" cy="55" rx="45" ry="16" fill="url(#ufo-body)" />
    <circle cx="35" cy="55" r="4" fill="#fff" /><circle cx="50" cy="57" r="4" fill="#fff" /><circle cx="65" cy="55" r="4" fill="#fff" />
  </svg>
);

// ================= 4. 主应用组件 =================
function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  const [activeTab, setActiveTab] = useState('swap');
  const [isBuyingUFO, setIsBuyingUFO] = useState(true);
  
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

      const promises = TOKENS.map(token => {
        const contract = new ethers.Contract(token.address, ERC20_ABI, rpcProvider);
        return contract.balanceOf(address);
      });
      
      const results = await Promise.allSettled(promises);
      const newBalances = {};
      results.forEach((res, index) => {
        const token = TOKENS[index];
        newBalances[token.symbol] = res.status === 'fulfilled' ? parseFloat(ethers.formatUnits(res.value, token.decimals)).toFixed(6) : '0.000000';
      });
      setTokenBalances(newBalances);
    } catch (error) {}
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
      setOutputAmount('0.000000'); setFeeAmount('0.000000'); setErrorMsg(''); return;
    }
    const fee = input * CONFIG.FEE_RATE;
    const netAmount = input - fee;
    setFeeAmount(fee.toFixed(6)); setOutputAmount(netAmount.toFixed(6));
    
    const currentBal = parseFloat(tokenBalances[isBuyingUFO ? 'USDT' : 'UFO'] || '0');
    if (isConnected && input > currentBal) setErrorMsg(`Insufficient ${isBuyingUFO ? 'USDT' : 'UFO'} balance`);
    else setErrorMsg('');
  }, [inputAmount, isBuyingUFO, tokenBalances, isConnected]);

  const handleAction = async () => {
    if (isProcessing) return;
    if (!isConnected || !walletProvider) return open({ view: 'AllWallets' });
    if (!(await ensureBscNetwork())) return;

    const input = parseFloat(inputAmount);
    if (!inputAmount || input <= 0 || isNaN(input) || errorMsg) return;

    setIsProcessing(true); setTxMsg(''); setErrorMsg('');

    try {
      const provider = new ethers.BrowserProvider(walletProvider);
      const bnbBalance = await provider.getBalance(address);
      if (parseFloat(ethers.formatEther(bnbBalance)) < 0.0005) throw new Error(`Insufficient BNB for gas.`);

      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, signer);
      const rawAmount = ethers.parseUnits(inputAmount, 18);

      if (isBuyingUFO) {
        const usdt = new ethers.Contract(CONFIG.USDT_ADDRESS, ERC20_ABI, signer);
        const allowance = await usdt.allowance(address, CONFIG.VAULT_ADDRESS);
        if (allowance < rawAmount) {
          setTxMsg('Approving USDT...');
          const txApprove = await usdt.approve(CONFIG.VAULT_ADDRESS, ethers.MaxUint256);
          await txApprove.wait();
        }
        setTxMsg('Swapping...');
        const tx = await vault.deposit(rawAmount);
        await tx.wait();
        setTxMsg('Swap Successful!');
      } else {
        setTxMsg('Redeeming...');
        const tx = await vault.withdraw(rawAmount);
        await tx.wait();
        setTxMsg('Redeem Successful!');
      }

      setInputAmount(''); setOutputAmount('0.000000'); setFeeAmount('0.000000'); fetchBalances();
    } catch (error) {
      setErrorMsg(error.reason || error.shortMessage || error.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
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
        {isConnected ? <AppKitButton balance="hide" /> : (
          <button onClick={() => open({ view: 'AllWallets' })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            Connect Wallet
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 85px 20px', zIndex: 10 }}>
        
        {activeTab === 'swap' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Swap</h3>
            
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Pay</span>
                <span>Balance: {isConnected ? (isBuyingUFO ? tokenBalances['USDT'] : tokenBalances['UFO']) || '0.0' : '0.000000'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} placeholder="0.000000" style={{ ...FONT_STYLE, background: 'transparent', border: 'none', outline: 'none', fontSize: '28px', fontWeight: '700', color: '#1e293b', width: '100%' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: '700' }}>
                  {isBuyingUFO ? <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 24, height: 24}} alt="USDT"/><span>USDT</span></> : <><UfoIcon size={28}/><span>UFO</span></>}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: '700' }}>
                  {isBuyingUFO ? <><UfoIcon size={28}/><span>UFO</span></> : <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 24, height: 24}} alt="USDT"/><span>USDT</span></>}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', background: '#f8fafc', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                <span>Rate</span><span>1 UFO = {currentNav} USDT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', marginBottom: '6px' }}>
                <span>Protocol Fee (0.5%)</span><span>-{feeAmount} USDT</span>
              </div>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700' }}>
                <span>Net Received</span><span>{outputAmount} {isBuyingUFO ? 'UFO' : 'USDT'}</span>
              </div>
            </div>

            {txMsg && <div style={{ marginTop: '15px', padding: '10px', textAlign: 'center', background: txMsg.includes('Successful') ? '#ecfdf5' : '#eff6ff', color: txMsg.includes('Successful') ? '#10b981' : '#3b82f6', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>{txMsg}</div>}

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
            {TOKENS.map((token, index) => (
              <div key={token.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: index !== TOKENS.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: index !== TOKENS.length - 1 ? '20px' : '0', marginBottom: index !== TOKENS.length - 1 ? '20px' : '0' }}>
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

        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', padding: '24px', borderRadius: '24px', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>Universal Crypto Settlement</div>
              <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px' }}>A stablecoin built for global settlement.</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is a global crypto settlement digital dollar stablecoin, fully pegged 1:1 to USDT. It is not listed on traditional exchanges and has no liquidity pools. Currently circulating in over 160 countries for enterprise trade, payroll, and personal payments.</p>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #1e293b, #475569)', padding: '24px', borderRadius: '24px', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px', color: 'rgba(255,255,255,0.7)' }}>Issuance & Reserves</div>
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Fully reserved 1:1. Permissionless minting.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is issued exclusively via smart contract and backed 1:1 by USDT held in a transparent vault. Minting occurs whenever any user deposits USDT; redemption triggers immediate token burning. All vault balances are fully verifiable on-chain.</p>
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Connect with Us</h2>
            <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '40px' }}>Follow our official channels for updates.</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '40px' }}>
              <a href="https://x.com/ufodollar" target="_blank" rel="noopener noreferrer"><div style={{ width: '72px', height: '72px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}><svg width="32" height="32" viewBox="0 0 24 24" fill="#000"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg></div></a>
              <a href="https://instagram.com/ufodollar" target="_blank" rel="noopener noreferrer"><div style={{ width: '72px', height: '72px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></div></a>
            </div>
            <div style={{ marginBottom: '32px', fontSize: '12px', color: '#94a3b8', fontWeight: '700', letterSpacing: '2px' }}>UFO built by StoneX</div>
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '8px 0 16px 0', zIndex: 20 }}>
        {['swap', 'assets', 'rules', 'contact'].map((tab) => (
          <div key={tab} onClick={() => setActiveTab(tab)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === tab ? '#0969da' : '#57606a', flex: 1, cursor: 'pointer' }}>
             <span style={{ fontSize: '11px', fontWeight: activeTab === tab ? '600' : '500', textTransform: 'capitalize' }}>{tab === 'assets' ? 'Wallet' : tab}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

const container = document.getElementById('root');
if (container) { container.innerHTML = ''; createRoot(container).render(<App />); }