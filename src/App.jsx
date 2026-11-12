import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, useAppKitProvider, createAppKit, AppKitButton } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import * as snarkjs from 'snarkjs';

// ================= 1. Web3 & 合约配置 =================
const CONFIG = {
  VAULT_ADDRESS: '0x16fBa21bB5c35A8D67118b38259329AA814ED0DE',
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',
  // 🔥 刚才部署到 BSC 主网的真实 Verifier 合约
  VERIFIER_ADDRESS: '0x924d7E7b18087CF76Bd7bc0b173B688ff97410c3', 
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
const VERIFIER_ABI = [
  "function verifyProof(uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[1] memory input) public view returns (bool)"
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
      redirect: {
        native: 'https://ufo-eea.pages.dev', 
        universal: 'https://ufo-eea.pages.dev',
        linkMode: true,
      },
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
  
  // ZK 状态
  const [zkStatus, setZkStatus] = useState('idle'); // idle, generating, verifying, success, error

  // --- 网络检查与切换 ---
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

  // --- 链上数据获取 ---
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
        newBalances[token.symbol] = res.status === 'fulfilled' 
          ? parseFloat(ethers.formatUnits(res.value, token.decimals)).toFixed(6)
          : '0.000000';
      });
      
      setTokenBalances(newBalances);
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

  // --- 双向 0.5% 手续费计算逻辑 ---
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
    
    const currentBal = parseFloat(tokenBalances[isBuyingUFO ? 'USDT' : 'UFO'] || '0');
    if (isConnected && input > currentBal) {
      setErrorMsg(`Insufficient ${isBuyingUFO ? 'USDT' : 'UFO'} balance`);
    } else {
      setErrorMsg('');
    }
  }, [inputAmount, isBuyingUFO, tokenBalances, isConnected]);

  // --- 核心操作逻辑 (Swap/Redeem) ---
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

    try {
      const provider = new ethers.BrowserProvider(walletProvider);
      const bnbBalance = await provider.getBalance(address);
      if (parseFloat(ethers.formatEther(bnbBalance)) < 0.0005) {
        throw new Error(`Insufficient BNB for gas. You need at least 0.0005 BNB.`);
      }

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

      setInputAmount('');
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      fetchBalances();
    } catch (error) {
      console.error(error);
      setErrorMsg(error.reason || error.shortMessage || error.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ZK 零知识证明生成与链上验证逻辑 ---
  const executeZKDemo = async () => {
    if (zkStatus === 'generating' || zkStatus === 'verifying') return;
    if (!isConnected || !walletProvider) return open({ view: 'AllWallets' });

    const isNetworkOk = await ensureBscNetwork();
    if (!isNetworkOk) return;

    try {
      setZkStatus('generating');
      setTxMsg('');
      
      // 1. 本地生成证明 (a=3, b=11 => c=33)
      const input = { a: 3, b: 11 };
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/multiplier.wasm",
        "/multiplier_final.zkey"
      );
      
      // 2. 格式化证明数据以适配 Solidity 合约
      const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
      const argv = JSON.parse("[" + calldata + "]");
      
      // 3. 调用主网合约进行链上验证
      setZkStatus('verifying');
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const verifierContract = new ethers.Contract(CONFIG.VERIFIER_ADDRESS, VERIFIER_ABI, signer);
      
      // 注意：由于 verifyProof 是 view 函数，直接读链不需要 Gas，这里连钱包都没弹，直接瞬间出结果
      const isValid = await verifierContract.verifyProof(argv[0], argv[1], argv[2], argv[3]);
      
      if (isValid) {
        setZkStatus('success');
      } else {
        throw new Error("链上合约返回验证失败");
      }

    } catch (error) {
      console.error("ZK Error:", error);
      setZkStatus('error');
    }
  };

  const formatUsd = (val) => Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const isButtonDisabled = isProcessing || (isConnected && (errorMsg !== '' || !inputAmount || parseFloat(inputAmount) <= 0));

  return (
    <div style={{ ...FONT_STYLE, display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#f8fafc', color: '#1e293b' }}>
      
      {/* 背景装饰 */}
      <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '250px', height: '250px', background: '#bfdbfe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '50px', right: '-50px', width: '250px', height: '250px', background: '#ddd6fe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>

      {/* 顶部 Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <UfoIcon size={28} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>UFO<span style={{ color: '#3b82f6' }}> Dollar</span></span>
        </div>

        {isConnected ? (
          <AppKitButton balance="hide" />
        ) : (
          <button onClick={() => open({ view: 'AllWallets' })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)', transition: 'all 0.2s ease' }}>
            Connect Wallet
          </button>
        )}
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', zIndex: 10 }}>
        
        {/* ====== Swap 页面 ====== */}
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
                  {isBuyingUFO ? (
                    <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 24, height: 24}} alt="USDT"/><span>USDT</span></>
                  ) : (
                    <><UfoIcon size={28}/><span>UFO</span></>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: '700' }}>
                  {isBuyingUFO ? (
                    <><UfoIcon size={28}/><span>UFO</span></>
                  ) : (
                    <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 24, height: 24}} alt="USDT"/><span>USDT</span></>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', background: '#f8fafc', borderRadius: '12px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                <span>Rate</span>
                <span>1 UFO = {currentNav} USDT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', marginBottom: '6px' }}>
                <span>Protocol Fee (0.5%)</span>
                <span>-{feeAmount} USDT</span>
              </div>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700' }}>
                <span>Net Received</span>
                <span>{outputAmount} {isBuyingUFO ? 'UFO' : 'USDT'}</span>
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

        {/* ====== Assets 页面 ====== */}
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

        {/* ====== Rules 页面 ====== */}
        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', padding: '28px', borderRadius: '24px', color: '#fff' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Universal Crypto Settlement Stablecoin</div>
              <h3 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '16px' }}>A stablecoin built for global settlement.</h3>
              <p style={{ fontSize: '15px', lineHeight: 1.7 }}>UFO is a global crypto settlement digital dollar stablecoin, fully pegged 1:1 to USDT. It is not listed on traditional exchanges and has no liquidity pools. It utilizes advanced cryptography to <b>prevent on-chain payment information leakage</b>, ensuring your transaction data is completely private. Currently, UFO is circulating in over 160 countries and is widely used in enterprise trade settlement, payroll, and personal payments.</p>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #1e293b, #475569)', padding: '24px', borderRadius: '24px', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Issuance & Reserves</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Fully reserved 1:1. Permissionless minting.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.7 }}>UFO is issued exclusively via smart contract and backed 1:1 by USDT held in a transparent vault. Minting occurs whenever any user deposits USDT; redemption triggers immediate token burning. All vault balances are fully verifiable on-chain via BscScan.</p>
            </div>
            {/* 其他卡片... */}
          </div>
        )}

        {/* ====== Contact 页面 (包含 ZK 演示) ====== */}
        {activeTab === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Connect with Us</h2>
            <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '30px' }}>Follow our official channels for updates and institutional onboarding.</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '24px' }}>
              {/* 社交图标... */}
            </div>

            <div style={{ marginBottom: '32px', fontSize: '13px', color: '#94a3b8', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>UFO built by StoneX</div>

            <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {/* 邮箱和地址卡片... */}
            </div>

            {/* 🔥 ZK 生产级演示区块 */}
            <div style={{ marginTop: '40px', width: '100%', maxWidth: '360px', padding: '24px', background: '#f8fafc', borderRadius: '20px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>Zero-Knowledge Capability Demo</h4>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
                Our infrastructure generates a Groth16 ZK-Proof directly in your browser and verifies it on the BNB Chain Mainnet.
              </p>
              
              <button 
                onClick={executeZKDemo}
                disabled={zkStatus === 'generating' || zkStatus === 'verifying'}
                style={{ 
                  width: '100%', padding: '14px', 
                  background: zkStatus === 'success' ? '#10b981' : (zkStatus === 'generating' || zkStatus === 'verifying' ? '#94a3b8' : '#8b5cf6'), 
                  color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: (zkStatus === 'generating' || zkStatus === 'verifying') ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                {zkStatus === 'idle' && '体验零知识证明 (ZK Demo)'}
                {zkStatus === 'generating' && '正在本地生成证明...'}
                {zkStatus === 'verifying' && '正在 BSC 主网验证...'}
                {zkStatus === 'success' && '✅ 链上验证成功 (Result: 33)'}
                {zkStatus === 'error' && '❌ 验证失败，点击重试'}
              </button>
              <p style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px' }}>
                *Runs purely client-side. Verifier Contract: {CONFIG.VERIFIER_ADDRESS.slice(0,6)}...{CONFIG.VERIFIER_ADDRESS.slice(-4)}
              </p>
            </div>

          </div>
        )}

      </div>

      {/* 底部导航栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#fff', borderTop: '1px solid #f1f5f9', padding: '10px 0 20px 0', zIndex: 20, flexShrink: 0 }}>
        {/* 导航按钮... */}
        <div onClick={() => setActiveTab('swap')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'swap' ? '#3b82f6' : '#94a3b8', flex: 1, cursor: 'pointer' }}><span style={{ fontSize: '11px', fontWeight: '700' }}>Swap</span></div>
        <div onClick={() => setActiveTab('assets')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'assets' ? '#3b82f6' : '#94a3b8', flex: 1, cursor: 'pointer' }}><span style={{ fontSize: '11px', fontWeight: '700' }}>Wallet</span></div>
        <div onClick={() => setActiveTab('rules')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'rules' ? '#3b82f6' : '#94a3b8', flex: 1, cursor: 'pointer' }}><span style={{ fontSize: '11px', fontWeight: '700' }}>Rules</span></div>
        <div onClick={() => setActiveTab('contact')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: activeTab === 'contact' ? '#3b82f6' : '#94a3b8', flex: 1, cursor: 'pointer' }}><span style={{ fontSize: '11px', fontWeight: '700' }}>Contact</span></div>
      </div>

    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  container.innerHTML = '';
  createRoot(container).render(<App />);
}