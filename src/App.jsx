import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAppKit, useAppKitAccount, useAppKitProvider, createAppKit } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. 初始化 Reown AppKit =================
const projectId = 'd6431212399f6c487b364387859983ea';

const metadata = {
  name: 'UFO Lending',
  description: 'P2P Lending with Chainlink',
  url: window.location.origin,
  icons: ['https://assets.coingecko.com/coins/images/325/large/Tether.png']
};

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [bsc],
  metadata,
  projectId,
  features: { analytics: true, allWallets: { showWallets: true } }
});

// ================= 2. 配置区 =================
const rpcProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
const BNB_ORACLE = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE'; // BNB/USD
const ETH_ORACLE = '0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e'; // ETH/USD

const ORACLE_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

function App() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');

  const [bnbPrice, setBnbPrice] = useState(0);
  const [ethPrice, setEthPrice] = useState(0);
  const [isPriceLoading, setIsPriceLoading] = useState(true);

  const [collateralAmount, setCollateralAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  
  const COLLATERAL_RATIO = 150; 
  const LIQUIDATION_THRESHOLD = 120; 

  const fetchPrices = async () => {
    try {
      const bnbContract = new ethers.Contract(BNB_ORACLE, ORACLE_ABI, rpcProvider);
      const ethContract = new ethers.Contract(ETH_ORACLE, ORACLE_ABI, rpcProvider);

      const bnbData = await bnbContract.latestRoundData();
      const ethData = await ethContract.latestRoundData();

      setBnbPrice(parseFloat(ethers.formatUnits(bnbData.answer, 8)));
      setEthPrice(parseFloat(ethers.formatUnits(ethData.answer, 8)));
      setIsPriceLoading(false);
    } catch (error) {
      console.error("获取价格失败:", error);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, []);

  const collateralValue = parseFloat(collateralAmount || 0) * bnbPrice; 
  const maxBorrow = (collateralValue * 100) / COLLATERAL_RATIO;
  
  let healthFactor = 0;
  if (parseFloat(borrowAmount) > 0) {
    healthFactor = (collateralValue * LIQUIDATION_THRESHOLD / 100) / parseFloat(borrowAmount);
  }

  let liquidationPrice = 0;
  if (parseFloat(collateralAmount) > 0) {
    liquidationPrice = (parseFloat(borrowAmount) * LIQUIDATION_THRESHOLD / 100) / parseFloat(collateralAmount);
  }

  const handleBorrow = () => {
    if (!isConnected) {
      // 调起 All Wallets 原生网格弹窗
      open({ view: 'AllWallets' }); 
      return;
    }
    if (parseFloat(borrowAmount) > maxBorrow) {
      alert("超额借款！");
      return;
    }
    alert(`准备借款 ${borrowAmount} USDT，正在唤起钱包签名...`);
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
        <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#64748b' }}>实时价格源: Chainlink Oracle</p>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <p style={{ margin: 0 }}>BNB Price: <strong style={{ color: '#0f172a' }}>${bnbPrice.toFixed(2)}</strong></p>
          <p style={{ margin: 0 }}>ETH Price: <strong style={{ color: '#0f172a' }}>${ethPrice.toFixed(2)}</strong></p>
        </div>
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
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '5px' }}>抵押物总价值: <strong style={{ color: '#0f172a' }}>${collateralValue.toFixed(2)} USDT</strong></p>
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

      {/* 风控健康度展示 */}
      {parseFloat(borrowAmount) > 0 && (
        <div style={{ border: '1px solid #e2e8f0', background: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>风控仪表盘</h3>
          <p style={{ margin: '0 0 5px 0', color: healthFactor < 1.2 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
            健康度: {healthFactor.toFixed(2)} {healthFactor < 1.2 ? ' (危险)' : ' (安全)'}
          </p>
          <p style={{ margin: 0, color: '#f59e0b', fontSize: '14px' }}>
            清算触发价: BNB 跌至 ${liquidationPrice.toFixed(2)} USDT
          </p>
        </div>
      )}

      <button 
        onClick={handleBorrow}
        disabled={isPriceLoading || (isConnected && parseFloat(borrowAmount) > maxBorrow)}
        style={{ 
          width: '100%', padding: '16px', background: isPriceLoading ? '#94a3b8' : '#3b82f6', 
          color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' 
        }}
      >
        {isPriceLoading ? '加载价格中...' : (!isConnected ? '连接钱包' : (parseFloat(borrowAmount) > maxBorrow ? '超额借款' : '确认借款'))}
      </button>
    </div>
  );
}

export default App;