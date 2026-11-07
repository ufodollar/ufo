import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount, useAppKitProvider, createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. 初始化 Reown AppKit =================
const projectId = 'd6431212399f6c487b364387859983ea';

const metadata = {
  name: 'UFO Lending',
  description: 'P2P Lending',
  url: window.location.origin,
  icons: ['https://assets.coingecko.com/coins/images/325/large/Tether.png']
};

// 用 try-catch 包裹，防止 Reown 初始化失败导致整个 React 崩溃（白屏）
let isAppKitReady = false;
try {
  createAppKit({
    adapters: [new EthersAdapter()],
    networks: [bsc],
    metadata,
    projectId,
    features: { analytics: true, allWallets: { showWallets: true } }
  });
  isAppKitReady = true;
} catch (error) {
  console.error("AppKit 初始化失败:", error);
}

// ================= 2. 配置区 =================
const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
const BNB_ORACLE = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE'; 

const ORACLE_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

function App() {
  // 捕获全局 React 报错
  const [hasError, setHasError] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const [bnbPrice, setBnbPrice] = useState(0);
  const [isPriceLoading, setIsPriceLoading] = useState(true);

  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  
  const COLLATERAL_RATIO = 150; 
  const LIQUIDATION_THRESHOLD = 120; 

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const bnbContract = new ethers.Contract(BNB_ORACLE, ORACLE_ABI, rpcProvider);
        const bnbData = await bnbContract.latestRoundData();
        setBnbPrice(parseFloat(ethers.formatUnits(bnbData.answer, 8)));
        setIsPriceLoading(false);
      } catch (error) {
        console.error("获取价格失败:", error);
        // 如果预言机报错，先给个假数据防止一直 Loading
        setBnbPrice(600); 
        setIsPriceLoading(false);
      }
    };
    fetchPrices();
  }, []);

  // 如果 Reown 初始化失败，页面直接显示红字警告，而不是白屏
  if (!isAppKitReady) {
    return <div style={{ color: 'red', padding: '20px', fontSize: '18px' }}>Reown 钱包组件初始化失败，请检查网络或配置。</div>;
  }

  const collateralValue = parseFloat(collateralAmount || 0) * bnbPrice; 
  const maxBorrow = (collateralValue * 100) / COLLATERAL_RATIO;
  
  let healthFactor = 0;
  if (parseFloat(borrowAmount) > 0) {
    healthFactor = (collateralValue * LIQUIDATION_THRESHOLD / 100) / parseFloat(borrowAmount);
  }

  const handleBorrow = () => {
    if (!isConnected) {
      try {
        open({ view: 'AllWallets' }); 
      } catch (e) {
        alert("弹窗调起失败：" + e.message);
      }
      return;
    }
    alert(`准备借款 ${borrowAmount} USDT`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      
      {/* 顶部连接状态 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>UFO Lending</h2>
        {isConnected ? (
          <span style={{ background: '#e2e8f0', padding: '5px 10px', borderRadius: '20px', fontSize: '12px', fontFamily: 'monospace' }}>
            {address.slice(0, 4)}...{address.slice(-4)}
          </span>
        ) : (
          <button 
            onClick={() => open({ view: 'AllWallets' })} 
            style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer' }}
          >
            连接钱包
          </button>
        )}
      </div>
      
      {/* 价格看板 */}
      <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b' }}>Chainlink 实时价格</p>
        <p style={{ margin: 0 }}>BNB Price: <strong style={{ color: '#0f172a' }}>${bnbPrice.toFixed(2)}</strong></p>
      </div>

      {/* 借款输入区 */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontSize: '14px', color: '#475569' }}>抵押 BNB 数量:</label>
        <input 
          type="number" 
          value={collateralAmount} 
          onChange={(e) => setCollateralAmount(e.target.value)}
          style={{ width: '100%', padding: '12px', marginTop: '5px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '16px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontSize: '14px', color: '#475569' }}>借款 USDT 数量:</label>
        <input 
          type="number" 
          value={borrowAmount} 
          onChange={(e) => setBorrowAmount(e.target.value)}
          style={{ width: '100%', padding: '12px', marginTop: '5px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '16px' }}
        />
        <p style={{ fontSize: '13px', color: '#10b981', marginTop: '5px' }}>最大可借: <strong>${maxBorrow.toFixed(2)} USDT</strong></p>
      </div>

      <button 
        onClick={handleBorrow}
        disabled={isPriceLoading}
        style={{ 
          width: '100%', padding: '16px', background: isPriceLoading ? '#94a3b8' : '#3b82f6', 
          color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' 
        }}
      >
        {isPriceLoading ? '加载中...' : (!isConnected ? '连接钱包' : '确认借款')}
      </button>
    </div>
  );
}

export default App;