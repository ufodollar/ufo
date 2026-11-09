import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, useAppKitProvider, createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. Init Reown AppKit =================
try {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    metadata: { name: 'UFO Dollar', description: 'Stablecoin Swap', url: window.location.origin, icons: [] },
    projectId: 'd6431212399f6c487b364387859983ea',
    features: { 
      analytics: true, 
      allWallets: { showWallets: true } 
    },
    featuredWalletIds: ['a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393']
  });
} catch (e) { console.error(e); }

// ================= 2. Config & ABI =================
const VAULT_ADDRESS = '0x16fBa21bB5c35A8D67118b38259329AA814ED0DE'; 
const UFO_ADDRESS = '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; 
const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");

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

const FEE_RATE = 0.005; 

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
  const [usdtBal, setUsdtBal] = useState('0.000000');
  const [ufoBal, setUfoBal] = useState('0.000000');
  const [bnbBal, setBnbBal] = useState('0.0000'); // 🌟 新增 BNB 余额状态
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [txMsg, setTxMsg] = useState('');

  const ensureBscNetwork = async () => {
    if (!walletProvider) return false;
    try {
      await walletProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }],
      });
      return true;
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await walletProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x38',
              chainName: 'BNB Smart Chain',
              nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
              rpcUrls: ['https://bsc-dataseed.binance.org/'],
              blockExplorerUrls: ['https://bscscan.com/']
            }],
          });
          return true;
        } catch (addError) {
          alert("Please add BNB Smart Chain to your wallet to continue.");
          return false;
        }
      }
      return false;
    }
  };

  useEffect(() => {
    if (isConnected && walletProvider) {
      ensureBscNetwork();
    }
  }, [isConnected, walletProvider]);

  useEffect(() => {
    const fetchNav = async () => {
      try {
        const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, rpcProvider);
        const rate = await vault.getExchangeRate();
        setCurrentNav(parseFloat(ethers.formatUnits(rate, 18)));
      } catch (error) {}
    };
    fetchNav();
  }, []);

  const fetchBalances = async () => {
    if (!address) return;
    try {
      const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, rpcProvider);
      const ufo = new ethers.Contract(UFO_ADDRESS, ERC20_ABI, rpcProvider);
      
      const uBal = await usdt.balanceOf(address);
      const ufoBalData = await ufo.balanceOf(address);
      // 🌟 获取原生 BNB 余额
      const bnbBalData = await rpcProvider.getBalance(address);
      
      setUsdtBal(parseFloat(ethers.formatUnits(uBal, 18)).toFixed(6));
      setUfoBal(parseFloat(ethers.formatUnits(ufoBalData, 18)).toFixed(6));
      setBnbBal(parseFloat(ethers.formatEther(bnbBalData)).toFixed(4));
    } catch (e) {}
  };

  useEffect(() => {
    if (isConnected) fetchBalances();
  }, [isConnected, address, activeTab]);

  useEffect(() => {
    const input = parseFloat(inputAmount);
    if (isNaN(input) || input <= 0 || !isFinite(input)) {
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      return;
    }

    if (isBuyingUFO) {
      const fee = input * FEE_RATE;
      const netUsdt = input - fee;
      setFeeAmount(fee.toFixed(6));
      setOutputAmount(netUsdt.toFixed(6));
    } else {
      const grossUsdt = input;
      const fee = grossUsdt * FEE_RATE;
      const netUsdt = grossUsdt - fee;
      setFeeAmount(fee.toFixed(6));
      setOutputAmount(netUsdt.toFixed(6));
    }
  }, [inputAmount, isBuyingUFO, currentNav]);

  const handleAction = async () => {
    if (isProcessing) return;
    if (!isConnected || !walletProvider) return open({ view: 'AllWallets' });
    
    const isNetworkOk = await ensureBscNetwork();
    if (!isNetworkOk) return;

    const input = parseFloat(inputAmount);
    if (!inputAmount || input <= 0 || isNaN(input)) return alert("Please enter a valid amount");

    if (isBuyingUFO) {
      if (input > parseFloat(usdtBal)) return alert("Insufficient USDT balance");
    } else {
      if (input > parseFloat(ufoBal)) return alert("Insufficient UFO balance");
    }

    setIsProcessing(true);
    setTxMsg('');

    try {
      const provider = new ethers.BrowserProvider(walletProvider);
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

      if (isBuyingUFO) {
        const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
        const rawAmount = ethers.parseUnits(inputAmount, 18);

        const allowance = await usdt.allowance(address, VAULT_ADDRESS);
        if (allowance < rawAmount) {
          setTxMsg('Approving USDT...');
          const txApprove = await usdt.approve(VAULT_ADDRESS, ethers.MaxUint256);
          await txApprove.wait();
        }

        setTxMsg('Swapping...');
        const tx = await vault.deposit(rawAmount);
        await tx.wait();
        setTxMsg('Swap Successful!');
      } else {
        const rawAmount = ethers.parseUnits(inputAmount, 18);
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
      setTxMsg(error.reason || error.shortMessage || 'Transaction rejected or failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatUsd = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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

        {isConnected ? (
          <button 
            onClick={() => open({ view: 'Account' })} 
            style={{ 
              background: '#fff', padding: '6px 12px', borderRadius: '20px', 
              fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', 
              color: '#1e293b', border: '1px solid #e2e8f0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', outline: 'none', gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></span>
              {address.slice(0, 4)}...{address.slice(-4)}
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        ) : (
          <button onClick={() => open({ view: 'AllWallets' })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            Connect Wallet
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', zIndex: 10 }}>
        
        {activeTab === 'swap' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Swap</h3>
            
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Pay</span>
                <span>Balance: {isConnected ? (isBuyingUFO ? usdtBal : ufoBal) : '0.000000'}</span>
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
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '-18px 0', position: 'relative', zIndex: 10 }}>
              <button onClick={() => { setIsBuyingUFO(!isBuyingUFO); setInputAmount(''); setTxMsg(''); }} disabled={isProcessing} style={{ background: '#fff', border: '4px solid #f8fafc', width: '48px', height: '48px', borderRadius: '50%', color: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isProcessing ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.1)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 20V4" />
                  <path d="M3 8l4-4 4 4" />
                  <path d="M17 4v16" />
                  <path d="M21 16l-4 4-4-4" />
                </svg>
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
                <span>Platform Fee (0.5%)</span>
                <span>-{feeAmount} {isBuyingUFO ? 'USDT' : 'USDT'}</span>
              </div>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700' }}>
                <span>Net Received</span>
                <span>{outputAmount} {isBuyingUFO ? 'UFO' : 'USDT'}</span>
              </div>
            </div>

            {txMsg && (
              <div style={{ marginTop: '15px', padding: '10px', textAlign: 'center', background: txMsg.includes('Successful') ? '#ecfdf5' : '#eff6ff', color: txMsg.includes('Successful') ? '#10b981' : '#3b82f6', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                {txMsg}
              </div>
            )}

            <button onClick={handleAction} disabled={isProcessing} style={{ ...FONT_STYLE, width: '100%', padding: '16px', background: isProcessing ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: isProcessing ? 'not-allowed' : 'pointer', marginTop: '20px', boxShadow: isProcessing ? 'none' : '0 8px 20px -5px rgba(59,130,246,0.4)' }}>
              {isProcessing ? 'Processing...' : (isConnected ? (isBuyingUFO ? 'Swap Now' : 'Redeem Now') : 'Connect Wallet')}
            </button>
          </div>
        )}

        {/* 🌟 资产页面更新 */}
        {activeTab === 'assets' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            
            {/* BNB 余额卡片 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="https://cryptologos.cc/logos/bnb-bnb-logo.png" style={{width: 40, height: 40}} alt="BNB"/>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>BNB</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400' }}>Gas Fee Token</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? bnbBal : '0.0000'}</span>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600', fontFamily: 'monospace' }}>Required for Gas</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 40, height: 40}} alt="USDT"/>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>USDT</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400' }}>Tether USD (BEP-20)</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? usdtBal : '0.000000'}</span>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace' }}>≈ ${formatUsd(usdtBal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{width: 40, height: 40, background: '#f8fafc', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                  <UfoIcon size={28}/>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>UFO</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '400' }}>UFO Dollar</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? ufoBal : '0.000000'}</span>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace' }}>≈ ${formatUsd(Number(ufoBal) * currentNav)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Rules 页面 */}
        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', padding: '28px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(30,58,138,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', marginBottom: '10px' }}>
                The Trusted Digital Dollar Stablecoin
              </div>
              <h3 style={{ fontSize: '26px', fontWeight: '800', lineHeight: 1.3, marginBottom: '16px' }}>
                A digital dollar built for global settlement.
              </h3>
              <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                UFO is a fully reserved digital dollar stablecoin issued by StoneX, designed for B2B cross-border payments and enterprise settlement. Operating on the BNB Smart Chain with a 1:1 USDT peg and a 0.5% protocol fee. Circulating in 160+ countries. Crucially, UFO leverages advanced cryptography to <b>prevent on-chain payment information leakage</b>, ensuring your commercial data remains completely private.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #0f766e, #14b8a6)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(15,118,110,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>Security</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Cryptographically tamper-proof.</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                Every UFO transaction is secured by blockchain-level cryptography. Once recorded, data cannot be altered, forged, or reversed by any party—including the issuer. Asset integrity is enforced by mathematics, not institutional trust alone.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(76,29,149,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>Global Reach & Confidentiality</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Circulating across 160+ countries. Commercial details shielded.</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                UFO is actively used for cross-border settlement in over 160 countries. Unlike public-chain transfers that expose payment amounts and counterparties to anyone with a block explorer, UFO applies ZK-based selective disclosure: transaction details remain hidden from public view, while authorized parties can verify specific data when required.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(67,56,202,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>Privacy & Compliance</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Confidential by default. Auditable by design.</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                Built on Zero-Knowledge technology, UFO keeps transaction amounts and counterparties off the public ledger. When regulators or auditors require verification, the holder can generate cryptographic proofs through Selective Disclosure—proving specific facts without exposing the entire transaction history.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #1e293b, #475569)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(30,41,59,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>Issuance & Reserves</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Issued by StoneX. Fully reserved 1:1. No arbitrary minting.</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                UFO is exclusively minted by StoneX and backed 1:1 by USDT held in a transparent vault. Minting occurs only when a verified party deposits USDT; redemption triggers immediate token burning. The issuer cannot create UFO without corresponding reserves. All vault balances are verifiable on-chain via BscScan.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(180,83,9,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>Settlement Speed</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Send money the way you send a message.</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                Cross-border payments shouldn't take days. With UFO, funds arrive in the recipient's wallet within seconds—no banking hours, no intermediary delays, no multi-day waiting. Settlement operates 24/7, every day of the year.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #064e3b, #10b981)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(6,78,59,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>Architecture</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>Closed-loop by design. Isolated from market speculation.</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                UFO is not listed on any public exchange and has no public liquidity pools. It operates as a permissioned settlement network, removing exposure to market manipulation and ensuring the asset remains a pure medium for enterprise fund clearing.
              </p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #7f1d1d, #ef4444)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px -10px rgba(127,29,29,0.3)', color: '#fff' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '2px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '8px' }}>Disclaimer</div>
              <h4 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>A payment instrument, not an investment product.</h4>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>
                UFO does not offer yields or returns. Users are solely responsible for ensuring their use of the protocol complies with the laws of their local jurisdiction. UFO is not offered to persons or entities located in restricted or comprehensively sanctioned jurisdictions. The following list is not exhaustive and includes, but is not limited to: <b>United States, Mainland China, North Korea, Iran, Syria, Cuba, Venezuela, Russia, Belarus, Myanmar, Sudan, South Sudan, Afghanistan, and the Crimea, Donetsk, and Luhansk regions</b>.
              </p>
            </div>

          </div>
        )}

        {activeTab === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div style={{ background: '#fff', padding: '24px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
              <h4 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>📬</span> Contact Us
              </h4>
              <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.8, marginBottom: '24px' }}>
                For institutional onboarding, enterprise integration, technical support, or general inquiries, please connect with our team through the channels below.
              </p>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Telegram</div>
                <a 
                  href="https://t.me/ufodollar" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', background: '#eff6ff', 
                    color: '#3b82f6', fontWeight: '700', fontSize: '15px', 
                    textDecoration: 'none', borderRadius: '12px', border: '1px solid #bfdbfe',
                    transition: '0.2s'
                  }}
                >
                  t.me/ufodollar
                </a>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Email</div>
                <a 
                  href="mailto:ufodollar6@gmail.com" 
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', background: '#f8fafc', 
                    color: '#1e293b', fontWeight: '700', fontSize: '15px', 
                    textDecoration: 'none', borderRadius: '12px', border: '1px solid #e2e8f0',
                    transition: '0.2s'
                  }}
                >
                  ufodollar6@gmail.com
                </a>
              </div>

              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px' }}>Office Address</div>
                <div 
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', background: '#f8fafc', 
                    color: '#1e293b', fontWeight: '700', fontSize: '15px', 
                    borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', lineHeight: '1.5'
                  }}
                >
                  Ritter House, Wickhams Cay 2,<br/>P.O. Box 3170, Road Town,<br/>Tortola, VG1110,<br/>British Virgin Islands
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#fff', borderTop: '1px solid #f1f5f9', padding: '10px 0 20px 0', zIndex: 20, flexShrink: 0 }}>
        <div onClick={() => setActiveTab('swap')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'swap' ? '#3b82f6' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer', flex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
          <span>Swap</span>
        </div>
        
        <div onClick={() => setActiveTab('assets')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'assets' ? '#3b82f6' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer', flex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span>Wallet</span>
        </div>

        <div onClick={() => setActiveTab('rules')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'rules' ? '#3b82f6' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer', flex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>Rules</span>
        </div>

        <div onClick={() => setActiveTab('contact')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'contact' ? '#3b82f6' : '#94a3b8', fontSize: '11px', fontWeight: '700', cursor: 'pointer', flex: 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
          </svg>
          <span>Contact</span>
        </div>
      </div>

    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  container.innerHTML = '';
  createRoot(container).render(<App />);
}