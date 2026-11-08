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
// ⚠️ 记得替换为你部署成功的真实地址
const VAULT_ADDRESS = '0x你的BSC金库地址'; 
const UFO_ADDRESS = '0x你的BSC_UFO地址';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT
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

// 0.5% 手续费率
const FEE_RATE = 0.005; 

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
  const [outputAmount, setOutputAmount] = useState('0.0');
  const [feeAmount, setFeeAmount] = useState('0.0');
  
  const [currentNav, setCurrentNav] = useState(10);
  const [usdtBal, setUsdtBal] = useState('0.0');
  const [ufoBal, setUfoBal] = useState('0.0');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [txMsg, setTxMsg] = useState('');

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
      
      // 使用精确格式，防止大数截断
      setUsdtBal(parseFloat(ethers.formatUnits(uBal, 18)).toString());
      setUfoBal(parseFloat(ethers.formatUnits(ufoBalData, 18)).toString());
    } catch (e) {}
  };

  useEffect(() => {
    if (isConnected) fetchBalances();
  }, [isConnected, address, activeTab]);

  useEffect(() => {
    const input = parseFloat(inputAmount);
    if (isNaN(input) || input <= 0 || !isFinite(input)) {
      setOutputAmount('0.0');
      setFeeAmount('0.0');
      return;
    }

    if (isBuyingUFO) {
      const fee = input * FEE_RATE;
      const netUsdt = input - fee;
      const outUfo = netUsdt / (currentNav || 1);
      setFeeAmount(fee.toFixed(4));
      setOutputAmount(outUfo.toFixed(4).replace(/\.?0+$/, ''));
    } else {
      const grossUsdt = input * (currentNav || 1);
      const fee = grossUsdt * FEE_RATE;
      const netUsdt = grossUsdt - fee;
      setFeeAmount(fee.toFixed(4));
      setOutputAmount(netUsdt.toFixed(4).replace(/\.?0+$/, ''));
    }
  }, [inputAmount, isBuyingUFO, currentNav]);

  // 🌟 漏洞修复 1：防止重复点击
  const handleAction = async () => {
    if (isProcessing) return;
    if (!isConnected || !walletProvider) return open({ view: 'AllWallets' });
    
    const input = parseFloat(inputAmount);
    if (!inputAmount || input <= 0 || isNaN(input)) return alert("Please enter a valid amount");

    // 🌟 漏洞修复 2：防止用户余额不足强行调用（节省 Gas）
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
        // 注意：传给合约的是完整的 inputAmount (如 100)，合约会自己去扣 0.5%
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
      setOutputAmount('0.0');
      setFeeAmount('0.0');
      fetchBalances();
    } catch (error) {
      console.error(error);
      // 更友好的错误提示
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#f8fafc' }}>
      
      <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '250px', height: '250px', background: '#bfdbfe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '50px', right: '-50px', width: '250px', height: '250px', background: '#ddd6fe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <UfoIcon size={28} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>UFO<span style={{ color: '#3b82f6' }}> Dollar</span></span>
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
            {/* 🌟 新增的切换符号 (向下箭头) */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        ) : (
          <button onClick={() => open({ view: 'AllWallets' })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            Connect Wallet
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', zIndex: 10 }}>
        
        {activeTab === 'swap' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '16px', fontWeight: '800', color: '#1e293b', marginBottom: '20px' }}>Swap</h3>
            
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Pay</span>
                <span>Balance: {isConnected ? (isBuyingUFO ? usdtBal : ufoBal) : '0.0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} placeholder="0.0" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '28px', fontWeight: '800', color: '#1e293b', width: '100%' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
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
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#94a3b8' }}>{outputAmount}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1e293b', fontWeight: 'bold' }}>
                <span>Net Received</span>
                <span>{outputAmount} {isBuyingUFO ? 'UFO' : 'USDT'}</span>
              </div>
            </div>

            {txMsg && (
              <div style={{ marginTop: '15px', padding: '10px', textAlign: 'center', background: txMsg.includes('Successful') ? '#ecfdf5' : '#eff6ff', color: txMsg.includes('Successful') ? '#10b981' : '#3b82f6', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                {txMsg}
              </div>
            )}

            <button onClick={handleAction} disabled={isProcessing} style={{ width: '100%', padding: '16px', background: isProcessing ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: isProcessing ? 'not-allowed' : 'pointer', marginTop: '20px', boxShadow: isProcessing ? 'none' : '0 8px 20px -5px rgba(59,130,246,0.4)' }}>
              {isProcessing ? 'Processing...' : (isConnected ? (isBuyingUFO ? 'Swap Now' : 'Redeem Now') : 'Connect Wallet')}
            </button>
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 40, height: 40}} alt="USDT"/>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>USDT</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Tether USD</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{isConnected ? usdtBal : '0.0'}</span>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600' }}>≈ ${formatUsd(usdtBal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{width: 40, height: 40, background: '#f8fafc', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                  <UfoIcon size={28}/>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>UFO</span>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>UFO Dollar</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>{isConnected ? ufoBal : '0.0'}</span>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600' }}>≈ ${formatUsd(Number(ufoBal) * currentNav)}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            
            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px', color: '#1e293b' }}>🔒 Closed-Loop & Off-Market</h4>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                UFO is <b>NOT a public market asset</b>. It will never be listed on any centralized or decentralized exchange (CEX/DEX), and no public liquidity pools will ever be created. UFO operates exclusively as a closed-loop settlement asset designed strictly for B2B high-value cross-border payments and enterprise fund clearing.
              </p>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px', color: '#1e293b' }}>🕶️ ZK-Powered Privacy & Compliance</h4>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                Built with <b>ZK (Zero-Knowledge) technology</b>, UFO provides enterprise-grade payment confidentiality. Your transaction amounts and counterparties are hidden from the public eye to protect commercial secrets. However, through Selective Disclosure, you can generate cryptographic proofs to share specific transaction data with auditors or regulators when required.
              </p>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px', color: '#1e293b' }}>🪙 100% Reserve & Instant Mint/Burn</h4>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                The UFO protocol strictly enforces a <b>1:10 USDT backing mechanism</b>. The system operates on an on-demand minting and burning basis, ensuring absolute transparency and liquidity:
                <br/><br/>
                <b>1. Instant Minting:</b> When you deposit USDT into the vault, the smart contract automatically calculates the equivalent UFO and mints it directly to your wallet.
                <br/><br/>
                <b>2. Instant Burning:</b> When you redeem, the UFO tokens are instantly burned from your wallet, and the corresponding USDT reserves are released to you from the vault.
                <br/><br/>
                This on-chain dynamic ensures that the total circulating supply of UFO always perfectly matches the actual reserve balance in the vault, eliminating any risk of unbacked issuance or fractional reserves. All vault balances and transaction states are fully auditable on BscScan.
              </p>
            </div>

            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px', color: '#1e293b' }}>⚠️ Disclaimer & Jurisdiction</h4>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                UFO is a payment and settlement tool, not an investment product. We do not promise any fixed annualized yield.<br/><br/>
                <strong>User Jurisdiction Notice:</strong> Users are solely responsible for ensuring that their access to and use of the UFO protocol complies with the laws, regulations, and policies of their local jurisdiction. UFO is not available to persons located in jurisdictions where such use is prohibited or restricted.
              </p>
            </div>
          </div>
        )}

      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#fff', borderTop: '1px solid #f1f5f9', padding: '10px 0 20px 0', zIndex: 20, flexShrink: 0 }}>
        <div onClick={() => setActiveTab('swap')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'swap' ? '#3b82f6' : '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
          <span>Swap</span>
        </div>
        
        <div onClick={() => setActiveTab('assets')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'assets' ? '#3b82f6' : '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
          <span>Wallet</span>
        </div>

        <div onClick={() => setActiveTab('rules')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'rules' ? '#3b82f6' : '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>Rules</span>
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