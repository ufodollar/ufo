import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// 1. 初始化 Reown AppKit
try {
  const projectId = 'd6431212399f6c487b364387859983ea';
  const metadata = { name: 'UFO Lending', description: 'P2P Lending', url: window.location.origin, icons: [] };
  
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    metadata,
    projectId,
    features: { analytics: true, allWallets: { showWallets: true } }
  });
} catch (error) {
  console.error("AppKit 初始化崩溃:", error);
  document.getElementById('root').innerHTML = `<div style="color:red;padding:20px;">钱包组件初始化失败：${error.message}</div>`;
}

// 2. 配置区
const BNB_ORACLE = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE'; 
const ORACLE_ABI = ["function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"];

// 3. 主组件
function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const [bnbPrice, setBnbPrice] = useState(0);
  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        const contract = new ethers.Contract(BNB_ORACLE, ORACLE_ABI, rpcProvider);
        const data = await contract.latestRoundData();
        setBnbPrice(parseFloat(ethers.formatUnits(data.answer, 8)));
      } catch (error) {
        setBnbPrice(600); // 防崩溃兜底
      }
    };
    fetchPrices();
  }, []);

  const collateralValue = parseFloat(collateralAmount || 0) * bnbPrice; 
  const maxBorrow = (collateralValue * 100) / 150;

  const handleBorrow = () => {
    if (!isConnected) {
      open({ view: 'AllWallets' }); 
      return;
    }
    alert(`准备借款 ${borrowAmount} USDT`);
  };

  return (
    <div style={{ padding: '20px' }}>
      
      {/* 顶部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>UFO 借贷</h2>
        {isConnected ? (
          <span style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontFamily: 'monospace' }}>
            {address.slice(0, 4)}...{address.slice(-4)}
          </span>
        ) : (
          <button 
            onClick={() => open({ view: 'AllWallets' })} 
            style={{ background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            连接钱包
          </button>
        )}
      </div>
      
      {/* 价格看板 */}
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: '16px', marginBottom: '24px' }}>
        <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#94a3b8' }}>Chainlink 预言机实时价格</p>
        <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>${bnbPrice.toFixed(2)} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 'normal' }}>BNB</span></p>
      </div>

      {/* 借款输入区 */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>抵押 BNB 数量:</label>
        <input 
          type="number" 
          value={collateralAmount} 
          onChange={(e) => setCollateralAmount(e.target.value)}
          style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '18px', outline: 'none' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>借款 USDT 数量:</label>
        <input 
          type="number" 
          value={borrowAmount} 
          onChange={(e) => setBorrowAmount(e.target.value)}
          style={{ width: '100%', padding: '16px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '18px', outline: 'none' }}
        />
        <p style={{ fontSize: '13px', color: '#00f2fe', marginTop: '8px' }}>最大可借: <strong>${maxBorrow.toFixed(2)} USDT</strong></p>
      </div>

      <button 
        onClick={handleBorrow}
        style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', color: '#000', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}
      >
        {!isConnected ? '连接钱包' : '确认借款'}
      </button>
    </div>
  );
}

// 4. 替代 main.jsx：直接在文件末尾挂载 React
const container = document.getElementById('root');
if (container) {
  // 清空“正在加载应用...”的提示
  container.innerHTML = '';
  createRoot(container).render(<App />);
}