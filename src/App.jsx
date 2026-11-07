import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. Init Reown AppKit =================
try {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    metadata: { name: 'UFO Ecosystem', description: 'Stablecoin Swap', url: window.location.origin, icons: [] },
    projectId: 'd6431212399f6c487b364387859983ea',
    features: { analytics: true, allWallets: { showWallets: true } }
  });
} catch (e) { console.error(e); }

// ================= 2. Config =================
const VAULT_ADDRESS = '0x你的BSC金库地址'; 
const UFO_ADDRESS = '0x你的BSC_UFO地址';
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
const VAULT_ABI = ["function getExchangeRate() view returns (uint256)"];
const FEE_RATE = 0.005; // 0.5% Fee

// Gradient UFO SVG Icon
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
    <path d="M 30 50 C 30 25, 70 25, 70 50 Z" fill="url(#ufo-glass)" />
    <ellipse cx="50" cy="55" rx="45" ry="16" fill="url(#ufo-body)" />
    <circle cx="35" cy="55" r="4" fill="#fff" />
    <circle cx="50" cy="57" r="4" fill="#fff" />
    <circle cx="65" cy="55" r="4" fill="#fff" />
  </svg>
);

// ================= 3. Main App =================
function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const [activeTab, setActiveTab] = useState('swap'); // swap, assets, rules
  const [isBuyingUFO, setIsBuyingUFO] = useState(true);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('0.0');
  const [currentNav, setCurrentNav] = useState(10);
  
  const [usdtBal, setUsdtBal] = useState('0.0');
  const [ufoBal, setUfoBal] = useState('0.0');

  // Fetch Exchange Rate
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

  // Fetch Balances
  const fetchBalances = async () => {
    if (!address) return;
    try {
      const usdt = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, rpcProvider);
      const ufo = new ethers.Contract(UFO_ADDRESS, ERC20_ABI, rpcProvider);
      const uBal = await usdt.balanceOf(address);
      const ufoBalData = await ufo.balanceOf(address);
      setUsdtBal(parseFloat(ethers.formatUnits(uBal, 6)).toFixed(4));
      setUfoBal(parseFloat(ethers.formatUnits(ufoBalData, 18)).toFixed(4));
    } catch (e) {}
  };

  useEffect(() => {
    if (isConnected) fetchBalances();
  }, [isConnected, address, activeTab]);

  // Calculate Output
  useEffect(() => {
    const input = parseFloat(inputAmount);
    if (isNaN(input) || input <= 0) {
      setOutputAmount('0.0');
      return;
    }
    let output = isBuyingUFO 
      ? (input * (1 - FEE_RATE)) / (currentNav || 1)
      : (input * (currentNav || 1)) * (1 - FEE_RATE);
    setOutputAmount(output.toFixed(4).replace(/\.?0+$/, ''));
  }, [inputAmount, isBuyingUFO, currentNav]);

  const handleAction = () => {
    if (!isConnected) return open({ view: 'AllWallets' });
    if (!inputAmount || Number(inputAmount) <= 0) return alert("Please enter a valid amount");
    alert(`Preparing ${isBuyingUFO ? 'Swap' : 'Redeem'}...`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#f8fafc' }}>
      
      {/* Background Glows */}
      <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '250px', height: '250px', background: '#bfdbfe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '50px', right: '-50px', width: '250px', height: '250px', background: '#ddd6fe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <UfoIcon size={28} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>UFO<span style={{ color: '#3b82f6' }}>Ecosystem</span></span>
        </div>

        {isConnected ? (
          <span style={{ background: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1e293b', border: '1px solid #e2e8f0' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#10b981', borderRadius: '50%', marginRight: '6px' }}></span>
            {address.slice(0, 4)}...{address.slice(-4)}
          </span>
        ) : (
          <button onClick={() => open({ view: 'AllWallets' })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
            Connect Wallet
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px', zIndex: 10 }}>
        
        {/* Tab 1: Swap */}
        {activeTab === 'swap' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '16px', fontWeight: '800', color: '#1e293b', marginBottom: '20px' }}>Swap</h3>
            
            {/* Pay Input */}
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Pay</span>
                <span>Balance: {isConnected ? (isBuyingUFO ? usdtBal : ufoBal) : '0.0'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="number" value={inputAmount} onChange={e => setInputAmount(e.target.value)} placeholder="0.0" style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '28px', fontWeight: '800', color: '#1e293b', width: '100%' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                  {isBuyingUFO ? (
                    <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 20, height: 20}} alt="USDT"/><span>USDT</span></>
                  ) : (
                    <><UfoIcon size={20}/><span>UFO</span></>
                  )}
                </div>
              </div>
            </div>

            {/* Switch Button */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '-18px 0', position: 'relative', zIndex: 10 }}>
              <button onClick={() => { setIsBuyingUFO(!isBuyingUFO); setInputAmount(''); }} style={{ background: '#fff', border: '4px solid #f8fafc', width: '44px', height: '44px', borderRadius: '50%', color: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 10l5-5 5 5"/><path d="M7 14l5 5 5-5"/></svg>
              </button>
            </div>

            {/* Receive Input */}
            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Receive</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#94a3b8' }}>{outputAmount}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                  {isBuyingUFO ? (
                    <><UfoIcon size={20}/><span>UFO</span></>
                  ) : (
                    <><img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 20, height: 20}} alt="USDT"/><span>USDT</span></>
                  )}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginTop: '20px', fontWeight: '600', background: '#f8fafc', borderRadius: '10px', padding: '10px' }}>
              Real-time Rate: 1 UFO ≈ <span style={{ color: '#3b82f6', fontWeight: '800' }}>{currentNav}</span> USDT
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#ef4444', marginTop: '8px', fontWeight: '500' }}>
              * A 0.5% fee applies to both buy and sell.
            </div>

            <button onClick={handleAction} style={{ width: '100%', padding: '16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', marginTop: '20px', boxShadow: '0 8px 20px -5px rgba(59,130,246,0.4)' }}>
              {isConnected ? (isBuyingUFO ? 'Swap Now' : 'Redeem Now') : 'Connect Wallet'}
            </button>
          </div>
        )}

        {/* Tab 2: Assets */}
        {activeTab === 'assets' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src="https://assets.coingecko.com/coins/images/325/large/Tether.png" style={{width: 36, height: 36}} alt="USDT"/>
                <span style={{ fontSize: '16px', fontWeight: '700' }}>USDT</span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>{isConnected ? usdtBal : '0.0'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{width: 36, height: 36, background: '#f8fafc', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center'}}><UfoIcon size={24}/></div>
                <span style={{ fontSize: '16px', fontWeight: '700' }}>UFO</span>
              </div>
              <span style={{ fontSize: '18px', fontWeight: '800' }}>{isConnected ? ufoBal : '0.0'}</span>
            </div>
          </div>
        )}

        {/* Tab 3: Rules */}
        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px' }}>🌐 Use Cases</h4>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>UFO is a decentralized stable asset issued on the BSC chain, designed for high-frequency cross-border payments and commercial settlements.</p>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px' }}>🛡️ Security Commitment</h4>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>100% capital reserves, transparent vault (on-chain auditable fund flows), and smart contracts strictly tested and audited.</p>
            </div>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
              <h4 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '10px' }}>⚠️ Disclaimer</h4>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>UFO is a payment and settlement tool, not an investment product. We do not promise any fixed annualized yield.</p>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Navigation Bar - Fixed at bottom */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#fff', borderTop: '1px solid #f1f5f9', padding: '10px 0 20px 0', zIndex: 20, flexShrink: 0 }}>
        <div onClick={() => setActiveTab('swap')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'swap' ? '#3b82f6' : '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4"/><path d="M4 7h16"/><path d="M16 21l4-4-4-4"/><path d="M20 17H4"/></svg>
          <span>Swap</span>
        </div>
        <div onClick={() => setActiveTab('assets')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: activeTab === 'assets' ? '#3b82f6' : '#94a3b8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          <span>Assets</span>
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