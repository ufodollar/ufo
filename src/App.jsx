import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { createRoot } from 'react-dom/client';
import { useAppKit, useAppKitAccount, useAppKitProvider, createAppKit, AppKitButton } from '@reown/appkit/react';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

// ================= 1. 配置 =================
const CONFIG = {
  VAULT_ADDRESS: '0x5C4eb7b82EFc4840e2fDa80Df73C53dc6b914790',
  UFO_ADDRESS: '0x9CB5e78F88EFfb5315A7B445aFa64790C8e53eaB',
  USDT_ADDRESS: '0x55d398326f99059fF775485246999027B3197955',
  USDC_ADDRESS: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  BNB_ORACLE: '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE',

  // 🟢 链上修复后，USDC 和 USDT 共用同一个喂价源，前端保持同步
  USDT_USD_FEED: '0xB97Ad0E74fa7d920791E90258A6E2085088b4320',
  USDC_USD_FEED: '0xB97Ad0E74fa7d920791E90258A6E2085088b4320',

  FEE_RATE: 0.005,
  PRICE_DECIMALS: 18,
  MAX_PRICE_DEVIATION: 0.02, // 2%
  MAX_PRICE_STALENESS: 3600, // 1 小时
  NAV_WARNING_THRESHOLD: 0.99,
};

const STABLECOINS = [
  { symbol: 'USDT', name: 'Tether USD', address: CONFIG.USDT_ADDRESS, icon: 'https://assets.coingecko.com/coins/images/325/large/Tether.png' },
  { symbol: 'USDC', name: 'USD Coin', address: CONFIG.USDC_ADDRESS, icon: 'https://assets.coingecko.com/coins/images/6319/large/usdc.png' }
];

const UFO_TOKEN = { symbol: 'UFO', name: 'UFO Dollar', address: CONFIG.UFO_ADDRESS, icon: 'UFO' };

// 🟢 更换为更稳定的公共 RPC
const rpcProvider = new ethers.JsonRpcProvider('https://bsc-dataseed1.defibit.io');

// ================= 2. ABIs =================
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

const VAULT_ABI = [
  'function deposit(address tokenAddress, uint256 amount)',
  'function withdraw(address tokenAddress, uint256 ufoAmount)',
  'function getExchangeRate() view returns (uint256)',
  'function getPrice(address tokenAddress) view returns (uint256)',
  'event Deposited(address indexed user, address indexed token, uint256 amount, uint256 ufoAmount, uint256 feeAmount)',
  'event Withdrawn(address indexed user, address indexed token, uint256 ufoAmount, uint256 amount, uint256 feeAmount)'
];

const CHAINLINK_ABI = [
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

const BNB_ORACLE_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
];

// ================= 3. Reown AppKit 初始化 =================
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
} catch (e) { console.error('AppKit Init Error:', e); }

// ================= 4. 样式与图标 =================
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

// ================= 5. Chainlink 价格读取 =================

async function readChainlinkPrice(feedAddress, blockTimestamp) {
  if (!feedAddress || feedAddress === ethers.ZeroAddress) {
    throw new Error('price feed not configured');
  }

  const feed = new ethers.Contract(feedAddress, CHAINLINK_ABI, rpcProvider);
  const [decimalsRaw, roundData] = await Promise.all([
    feed.decimals(),
    feed.latestRoundData()
  ]);

  const decimals = Number(decimalsRaw);
  const { roundId, answer, updatedAt, answeredInRound } = roundData;

  if (answer <= 0n) throw new Error('invalid price (answer <= 0)');
  if (updatedAt === 0n) throw new Error('stale price (updatedAt = 0)');

  if (blockTimestamp !== null && Number(blockTimestamp) - Number(updatedAt) > CONFIG.MAX_PRICE_STALENESS) {
    throw new Error('stale price (exceeds max staleness)');
  }
  if (answeredInRound < roundId) throw new Error('stale price (answeredInRound < roundId)');

  let price18 = BigInt(answer);
  if (decimals < 18) {
    price18 *= 10n ** BigInt(18 - decimals);
  } else if (decimals > 18) {
    price18 /= 10n ** BigInt(decimals - 18);
  }

  return {
    price18,
    priceFloat: Number(price18) / 1e18,
    decimals,
    updatedAt: Number(updatedAt),
    roundId: roundId.toString(),
    isFallback: false
  };
}

async function fetchStablecoinPricesFromChainlink() {
  let blockTimestamp = null;
  try {
    const block = await rpcProvider.getBlock('latest');
    blockTimestamp = block?.timestamp ?? null;
  } catch (_) {}

  const [usdtResult, usdcResult] = await Promise.allSettled([
    readChainlinkPrice(CONFIG.USDT_USD_FEED, blockTimestamp),
    readChainlinkPrice(CONFIG.USDC_USD_FEED, blockTimestamp)
  ]);

  const result = {
    USDT: null,
    USDC: null,
    errors: [],
    source: 'chainlink',
    lastUpdated: Date.now(),
    blockTimestamp
  };

  // 🟢 兜底逻辑：如果读取失败，绝不返回 null，回退到 1.0 并打上标记
  if (usdtResult.status === 'fulfilled') {
    result.USDT = usdtResult.value;
  } else {
    result.USDT = { price18: 10n ** 18n, priceFloat: 1.0, isFallback: true };
    result.errors.push({ token: 'USDT', message: 'Price feed failed. Using $1.00 fallback.' });
  }

  if (usdcResult.status === 'fulfilled') {
    result.USDC = usdcResult.value;
  } else {
    result.USDC = { price18: 10n ** 18n, priceFloat: 1.0, isFallback: true };
    result.errors.push({ token: 'USDC', message: 'Price feed failed. Using $1.00 fallback.' });
  }

  return result;
}

// ================= 6. 主应用 =================
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
  const [navStatus, setNavStatus] = useState('loading'); 

  const [bnbPrice, setBnbPrice] = useState(600);

  const [stablecoinPrices, setStablecoinPrices] = useState({
    USDT: { price18: 10n ** 18n, priceFloat: 1.0, isFallback: false },
    USDC: { price18: 10n ** 18n, priceFloat: 1.0, isFallback: false },
    errors: [],
    source: 'chainlink',
    lastUpdated: null,
    blockTimestamp: null
  });

  const [bnbBal, setBnbBal] = useState('0.000000');
  const [tokenBalances, setTokenBalances] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [txMsg, setTxMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [history, setHistory] = useState([]);

  const priceRefreshingRef = useRef(false);
  const balanceRefreshingRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('ufo_tx_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
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

  const fetchNav = useCallback(async () => {
    try {
      const vault = new ethers.Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, rpcProvider);
      const rate = await vault.getExchangeRate();
      const nav = parseFloat(ethers.formatUnits(rate, 18));
      if (!isFinite(nav) || nav <= 0) {
        setNavStatus('error');
        return;
      }
      setCurrentNav(nav);
      setNavStatus('ready');
    } catch (err) {
      setNavStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchNav();
    const interval = setInterval(fetchNav, 15000);
    return () => clearInterval(interval);
  }, [fetchNav]);

  const refreshPrices = useCallback(async () => {
    if (priceRefreshingRef.current) return;
    priceRefreshingRef.current = true;
    try {
      const prices = await fetchStablecoinPricesFromChainlink();
      setStablecoinPrices(prices);
    } catch (err) {
      setStablecoinPrices(prev => ({
        ...prev,
        errors: [{ token: 'GLOBAL', message: 'Price refresh failed' }],
        lastUpdated: Date.now()
      }));
    } finally {
      priceRefreshingRef.current = false;
    }
  }, []);

  const fetchVaultBalances = useCallback(async () => {
    if (balanceRefreshingRef.current) return;
    balanceRefreshingRef.current = true;
    try {
      const vaultUsdt = new ethers.Contract(CONFIG.USDT_ADDRESS, ERC20_ABI, rpcProvider);
      const vaultUsdc = new ethers.Contract(CONFIG.USDC_ADDRESS, ERC20_ABI, rpcProvider);
      const [vUsdt, vUsdc] = await Promise.all([
        vaultUsdt.balanceOf(CONFIG.VAULT_ADDRESS),
        vaultUsdc.balanceOf(CONFIG.VAULT_ADDRESS)
      ]);
      setVaultBalances({
        USDT: parseFloat(ethers.formatUnits(vUsdt, 18)),
        USDC: parseFloat(ethers.formatUnits(vUsdc, 18))
      });
    } catch (error) {
      console.error('Vault balances fetch failed:', error);
    } finally {
      balanceRefreshingRef.current = false;
    }
  }, []);

  const fetchUserBalances = useCallback(async () => {
    if (!address || !walletProvider) return;
    try {
      const browserProvider = new ethers.BrowserProvider(walletProvider);
      const bnbBalanceWei = await browserProvider.getBalance(address);
      setBnbBal(parseFloat(ethers.formatEther(bnbBalanceWei)).toFixed(6));

      const oracleContract = new ethers.Contract(CONFIG.BNB_ORACLE, BNB_ORACLE_ABI, rpcProvider);
      const priceData = await oracleContract.latestRoundData();
      setBnbPrice(parseFloat(ethers.formatUnits(priceData.answer, 8)));

      const allTokens = [...STABLECOINS, UFO_TOKEN];
      const results = await Promise.allSettled(
        allTokens.map(token => {
          const contract = new ethers.Contract(token.address, ERC20_ABI, rpcProvider);
          return contract.balanceOf(address);
        })
      );

      const newBalances = {};
      results.forEach((res, index) => {
        const token = allTokens[index];
        newBalances[token.symbol] = res.status === 'fulfilled'
          ? parseFloat(ethers.formatUnits(res.value, 18)).toFixed(6)
          : '0.000000';
      });
      setTokenBalances(newBalances);
    } catch (error) {
      console.error('User balances fetch failed:', error);
    }
  }, [address, walletProvider]);

  useEffect(() => {
    refreshPrices();
    fetchVaultBalances();
    const interval = setInterval(() => {
      refreshPrices();
      fetchVaultBalances();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshPrices, fetchVaultBalances]);

  useEffect(() => {
    if (!isConnected || !address) {
      setTokenBalances({});
      setBnbBal('0.000000');
      return;
    }
    fetchUserBalances();
    const interval = setInterval(fetchUserBalances, 5000);
    return () => clearInterval(interval);
  }, [isConnected, address, fetchUserBalances]);

  const currentPriceData = selectedStablecoin.symbol === 'USDT' ? stablecoinPrices.USDT : stablecoinPrices.USDC;
  const currentPriceError = stablecoinPrices.errors.find(e => e.token === selectedStablecoin.symbol);
  const globalPriceError = stablecoinPrices.errors.find(e => e.token === 'GLOBAL');
  const priceReady = !!currentPriceData && !globalPriceError;

  useEffect(() => {
    const input = parseFloat(inputAmount);
    if (isNaN(input) || input <= 0 || !isFinite(input)) {
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      setErrorMsg('');
      return;
    }

    if (globalPriceError) {
      setErrorMsg('Price feed unavailable. Please retry.');
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      return;
    }

    const price18 = currentPriceData.price18;
    const deviation = price18 > 10n ** 18n ? price18 - 10n ** 18n : 10n ** 18n - price18;
    if (Number(deviation * 10000n / 10n ** 18n) > CONFIG.MAX_PRICE_DEVIATION * 10000) {
      setErrorMsg(`${selectedStablecoin.symbol} price deviation exceeds 2%. Trading paused.`);
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      return;
    }

    const inputWei = ethers.parseUnits(inputAmount, 18);

    if (isBuyingUFO) {
      const usdValue = (inputWei * price18) / 10n ** 18n;
      const feeUsd = (usdValue * 50n) / 10000n;
      const feeTokens = feeUsd === 0n ? 0n : (feeUsd * 10n ** 18n) / price18;
      const ufoAmount = usdValue - feeUsd;

      const currentBal = parseFloat(tokenBalances[selectedStablecoin.symbol] || '0');
      if (isConnected && input > currentBal) {
        setErrorMsg(`Insufficient ${selectedStablecoin.symbol} balance`);
      } else {
        setErrorMsg('');
      }

      setFeeAmount(parseFloat(ethers.formatUnits(feeTokens, 18)).toFixed(6));
      setOutputAmount(parseFloat(ethers.formatUnits(ufoAmount, 18)).toFixed(6));
    } else {
      const feeUfo = (inputWei * 50n) / 10000n;
      const netUfo = inputWei - feeUfo;
      const tokenOut = (netUfo * 10n ** 18n) / price18;

      const currentVaultBal = vaultBalances[selectedStablecoin.symbol] || 0;
      const tokenOutFloat = parseFloat(ethers.formatUnits(tokenOut, 18));
      if (tokenOutFloat > currentVaultBal) {
        setErrorMsg(`Insufficient ${selectedStablecoin.symbol} in Vault. Available: ${currentVaultBal.toFixed(2)}`);
      } else {
        const currentBal = parseFloat(tokenBalances['UFO'] || '0');
        if (isConnected && input > currentBal) {
          setErrorMsg('Insufficient UFO balance');
        } else {
          setErrorMsg('');
        }
      }

      setFeeAmount(parseFloat(ethers.formatUnits(feeUfo, 18)).toFixed(6));
      setOutputAmount(parseFloat(ethers.formatUnits(tokenOut, 18)).toFixed(6));
    }
  }, [inputAmount, isBuyingUFO, tokenBalances, isConnected, selectedStablecoin, vaultBalances, currentPriceData, currentPriceError, globalPriceError]);

  const handleAction = async () => {
    if (isProcessing) return;
    if (!isConnected || !walletProvider) return open({ view: 'AllWallets' });

    const isNetworkOk = await ensureBscNetwork();
    if (!isNetworkOk) return;

    const input = parseFloat(inputAmount);
    if (!inputAmount || input <= 0 || isNaN(input) || errorMsg) return;

    if (!priceReady) {
      setErrorMsg('Price feed not ready');
      return;
    }

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
      if (parseFloat(ethers.formatEther(bnbBalance)) < 0.0005) {
        throw new Error('Insufficient BNB for gas.');
      }

      const vaultRead = new ethers.Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, rpcProvider);
      try {
        await vaultRead.getPrice(selectedStablecoin.address);
      } catch (priceErr) {
        const reason = priceErr.reason || priceErr.shortMessage || priceErr.message || 'Price check failed';
        throw new Error(`Vault rejected price: ${reason}`);
      }

      const signer = await provider.getSigner();
      const vault = new ethers.Contract(CONFIG.VAULT_ADDRESS, VAULT_ABI, signer);

      let receipt;

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
        receipt = await tx.wait();
        txRecord.txHash = tx.hash;

        for (const log of receipt.logs) {
          try {
            const parsed = vault.interface.parseLog(log);
            if (parsed && parsed.name === 'Deposited') {
              const args = parsed.args;
              txRecord.receiveAmount = parseFloat(ethers.formatUnits(args.ufoAmount, 18)).toFixed(6);
              txRecord.payAmount = parseFloat(ethers.formatUnits(args.amount, 18)).toFixed(6);
              break;
            }
          } catch (_) {}
        }

        txRecord.status = 'Success';
        setTxMsg('Swap Successful!');

      } else {
        const rawAmount = ethers.parseUnits(inputAmount, 18);
        setTxMsg('Redeeming...');
        const tx = await vault.withdraw(selectedStablecoin.address, rawAmount);
        receipt = await tx.wait();
        txRecord.txHash = tx.hash;

        for (const log of receipt.logs) {
          try {
            const parsed = vault.interface.parseLog(log);
            if (parsed && parsed.name === 'Withdrawn') {
              const args = parsed.args;
              txRecord.receiveAmount = parseFloat(ethers.formatUnits(args.amount, 18)).toFixed(6);
              txRecord.payAmount = parseFloat(ethers.formatUnits(args.ufoAmount, 18)).toFixed(6);
              break;
            }
          } catch (_) {}
        }

        txRecord.status = 'Success';
        setTxMsg('Redeem Successful!');
      }

      saveTxToHistory(txRecord);
      setInputAmount('');
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      fetchUserBalances();
      fetchVaultBalances();
      fetchNav();

    } catch (error) {
      console.error(error);
      setErrorMsg(error.reason || error.shortMessage || error.message || 'Transaction failed');
      txRecord.status = 'Failed';
      txRecord.txHash = '-';
      saveTxToHistory(txRecord);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all local history?')) {
      localStorage.removeItem('ufo_tx_history');
      setHistory([]);
    }
  };

  // 格式化工具：普通美元 2 位小数，代币单价 4 位小数
  const formatUsd = (val) => Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatPrice = (val, isBnb = false) => {
    if (isBnb) return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  };

  const isButtonDisabled =
    isProcessing ||
    (isConnected && (
      errorMsg !== '' ||
      !inputAmount ||
      parseFloat(inputAmount) <= 0 ||
      !priceReady
    ));

  const currentPayPrice = isBuyingUFO
    ? (currentPriceData?.priceFloat ?? null)
    : currentNav;

  const navWarning = navStatus === 'ready' && currentNav < CONFIG.NAV_WARNING_THRESHOLD;

  return (
    <div style={{ ...FONT_STYLE, display: 'flex', flexDirection: 'column', height: '100dvh', width: '100%', position: 'relative', backgroundColor: '#f8fafc', color: '#1e293b' }}>

      <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '250px', height: '250px', background: '#bfdbfe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>
      <div style={{ position: 'absolute', bottom: '50px', right: '-50px', width: '250px', height: '250px', background: '#ddd6fe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0 }}></div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <UfoIcon size={28} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>UFO<span style={{ color: '#3b82f6' }}> Dollar</span></span>
        </div>
        <div>
          {isConnected ? <AppKitButton balance="hide" /> : (
            <button onClick={() => open({ view: 'AllWallets' })} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 85px 20px', zIndex: 10 }}>

        {activeTab === 'swap' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Swap</h3>

            {/* 🟢 状态条：默认隐藏，仅在真正发生错误时显示 */}
            {currentPriceError && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', marginBottom: '16px', fontWeight: '600', color: '#ef4444' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                {currentPriceError.message}
              </div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Pay</span>
                <span>Balance: {isConnected ? (isBuyingUFO ? tokenBalances[selectedStablecoin.symbol] : tokenBalances['UFO']) || '0.0' : '0.000000'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input
                  type="number"
                  value={inputAmount}
                  onChange={e => setInputAmount(e.target.value)}
                  placeholder="0.000000"
                  style={{ ...FONT_STYLE, background: 'transparent', border: 'none', outline: 'none', fontSize: '28px', fontWeight: '700', color: '#1e293b', width: '100%' }}
                />
                <div
                  onClick={() => { if (isBuyingUFO) setShowTokenMenu(!showTokenMenu); }}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', background: '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: isBuyingUFO ? 'pointer' : 'default' }}
                >
                  {isBuyingUFO ? (
                    <><img src={selectedStablecoin.icon} style={{ width: 24, height: 24 }} alt={selectedStablecoin.symbol} /><span>{selectedStablecoin.symbol}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg></>
                  ) : (
                    <><UfoIcon size={28} /><span>UFO</span></>
                  )}
                  {showTokenMenu && isBuyingUFO && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', minWidth: '180px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 100, overflow: 'hidden' }}>
                      {STABLECOINS.map(coin => {
                        const coinPrice = coin.symbol === 'USDT' ? stablecoinPrices.USDT : stablecoinPrices.USDC;
                        const coinErr = stablecoinPrices.errors.find(e => e.token === coin.symbol);
                        return (
                          <div key={coin.symbol} onClick={(e) => { e.stopPropagation(); setSelectedStablecoin(coin); setShowTokenMenu(false); setInputAmount(''); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                            <img src={coin.icon} style={{ width: 20, height: 20 }} alt={coin.symbol} />
                            <span style={{ fontSize: '14px', color: '#1e293b' }}>{coin.symbol}</span>
                            <span style={{ fontSize: '11px', color: coinErr ? '#ef4444' : '#94a3b8', marginLeft: 'auto' }}>
                              {coinErr ? 'Fallback $1.00' : (coinPrice ? `≈ $${coinPrice.priceFloat.toFixed(4)}` : '—')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600', marginTop: '8px' }}>{errorMsg}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', margin: '-18px 0', position: 'relative', zIndex: 10 }}>
              <button
                onClick={() => { setIsBuyingUFO(!isBuyingUFO); setInputAmount(''); setTxMsg(''); setErrorMsg(''); }}
                disabled={isProcessing}
                style={{ background: '#fff', border: '4px solid #f8fafc', width: '48px', height: '48px', borderRadius: '50%', color: '#3b82f6', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: isProcessing ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.1)' }}
              >
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
                    <><UfoIcon size={28} /><span>UFO</span></>
                  ) : (
                    <><img src={selectedStablecoin.icon} style={{ width: 24, height: 24 }} alt={selectedStablecoin.symbol} /><span>{selectedStablecoin.symbol}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg></>
                  )}
                  {showTokenMenu && !isBuyingUFO && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', minWidth: '180px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 100, overflow: 'hidden' }}>
                      {STABLECOINS.map(coin => (
                        <div key={coin.symbol} onClick={(e) => { e.stopPropagation(); setSelectedStablecoin(coin); setShowTokenMenu(false); setInputAmount(''); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                          <img src={coin.icon} style={{ width: 20, height: 20 }} alt={coin.symbol} />
                          <span style={{ fontSize: '14px', color: '#1e293b' }}>{coin.symbol}</span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>Pool: {vaultBalances[coin.symbol].toFixed(2)}</span>
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
                <span>Pay Price</span>
                <span>1 {isBuyingUFO ? selectedStablecoin.symbol : 'UFO'} = ${currentPayPrice !== null ? currentPayPrice.toFixed(4) : '—'} USD</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                <span>UFO NAV (on-chain)</span>
                <span style={{ color: navWarning ? '#ef4444' : '#64748b' }}>
                  1 UFO = ${currentNav.toFixed(4)} USD
                  {navStatus === 'error' && <span style={{ marginLeft: 6 }}>(read failed)</span>}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', marginBottom: '6px' }}>
                <span>Protocol Fee (0.5%)</span>
                <span>-{feeAmount} {isBuyingUFO ? selectedStablecoin.symbol : 'UFO'}</span>
              </div>
              <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: '700' }}>
                <span>Net Received (estimated)</span>
                <span>{outputAmount} {isBuyingUFO ? 'UFO' : selectedStablecoin.symbol}</span>
              </div>

              {navWarning && (
                <div style={{ marginTop: '10px', padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', color: '#b91c1c', fontWeight: '600' }}>
                  ⚠️ On-chain NAV is below $1.00 ({currentNav.toFixed(4)}). Vault reserves may be insufficient. Proceed with caution.
                </div>
              )}

              <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                Final amount is determined by the Vault contract at execution time using the same Chainlink feed. The on-chain event will be parsed after confirmation to display the actual received amount.
              </div>
            </div>

            {txMsg && (
              <div style={{ marginTop: '15px', padding: '10px', textAlign: 'center', background: txMsg.includes('Successful') ? '#ecfdf5' : '#eff6ff', color: txMsg.includes('Successful') ? '#10b981' : '#3b82f6', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>{txMsg}</div>
            )}

            <button
              onClick={handleAction}
              disabled={isButtonDisabled}
              style={{ ...FONT_STYLE, width: '100%', padding: '16px', background: isButtonDisabled ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: isButtonDisabled ? 'not-allowed' : 'pointer', marginTop: '20px', boxShadow: isButtonDisabled ? 'none' : '0 8px 20px -5px rgba(59,130,246,0.4)' }}
            >
              {isProcessing ? 'Processing...' : (isConnected ? (isBuyingUFO ? 'Swap Now' : 'Redeem Now') : 'Connect Wallet')}
            </button>
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{ background: '#fff', borderRadius: '24px', padding: '20px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9', marginTop: '10px' }}>
            
            {/* BNB */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="https://cryptologos.cc/logos/bnb-bnb-logo.png" style={{ width: 40, height: 40 }} alt="BNB" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700' }}>BNB</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Gas Fee Token</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? bnbBal : '0.000000'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>${formatPrice(bnbPrice, true)}</span>
                  <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace' }}>≈ ${formatUsd(Number(bnbBal) * bnbPrice)}</span>
                </div>
              </div>
            </div>

            {/* USDT, USDC, UFO */}
            {[...STABLECOINS, UFO_TOKEN].map((token, index, arr) => {
              let currentPrice = 1.0;
              let isFallback = false;
              if (token.symbol === 'UFO') {
                currentPrice = currentNav;
              } else if (token.symbol === 'USDT') {
                currentPrice = stablecoinPrices.USDT?.priceFloat ?? 1.0;
                isFallback = stablecoinPrices.USDT?.isFallback;
              } else if (token.symbol === 'USDC') {
                currentPrice = stablecoinPrices.USDC?.priceFloat ?? 1.0;
                isFallback = stablecoinPrices.USDC?.isFallback;
              }

              return (
                <div key={token.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: index !== arr.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: index !== arr.length - 1 ? '20px' : '0', marginBottom: index !== arr.length - 1 ? '20px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {token.icon === 'UFO' ? <div style={{ width: 40, height: 40, background: '#f8fafc', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><UfoIcon size={28} /></div> : <img src={token.icon} style={{ width: 40, height: 40 }} alt={token.symbol} />}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '16px', fontWeight: '700' }}>{token.symbol}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{token.name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? tokenBalances[token.symbol] || '0.000000' : '0.000000'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', color: isFallback ? '#ef4444' : '#64748b' }}>
                        ${formatPrice(currentPrice)} {isFallback && '*'}
                      </span>
                      <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace' }}>
                        ≈ ${formatUsd(Number(tokenBalances[token.symbol] || 0) * currentPrice)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
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
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px auto' }}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p style={{ fontSize: '14px' }}>No transaction history found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((tx, idx) => (
                  <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: tx.type === 'Swap' ? '#3b82f6' : '#8b5cf6' }}>{tx.type}</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{tx.time}</span>
                      </div>
                      <span style={{
                        fontSize: '12px', fontWeight: '700',
                        color: tx.status === 'Success' ? '#10b981' : (tx.status === 'Failed' ? '#ef4444' : '#f59e0b'),
                        background: tx.status === 'Success' ? '#ecfdf5' : (tx.status === 'Failed' ? '#fef2f2' : '#fffbeb'),
                        padding: '2px 8px', borderRadius: '10px'
                      }}>{tx.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                      <div>Paid: <span style={{ fontWeight: '600', color: '#1e293b' }}>{tx.payAmount} {tx.paySymbol}</span></div>
                      <div style={{ textAlign: 'right' }}>Received: <span style={{ fontWeight: '600', color: '#1e293b' }}>{tx.receiveAmount} {tx.receiveSymbol}</span></div>
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
            <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,58,138,0.3)' }}>
              <CardHeader title="The Value-Invisible Stablecoin" iconType="eye" />
              <h3 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '12px' }}>Designed for concealing stablecoin assets and private commercial settlement.</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is a USD-pegged stablecoin engineered for absolute asset protection. By avoiding public exchange listings, standard wallets display its fiat value as <b>$0.00</b>. This acts as a powerful physical camouflage against extortion and automated wallet-draining bots.</p>
              <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', fontSize: '14px', lineHeight: 1.6 }}>
                <b>How it works:</b> Mint UFO with USDT/USDC and send it to your commercial partners. They can seamlessly redeem it for stablecoins, bypassing the friction and exposure of traditional transfers.
              </div>
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>
                🌍 Currently widely used in over 60 countries globally for cryptocurrency security and private commercial settlement.
              </div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #1e293b, #475569)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(30,41,59,0.3)' }}>
              <CardHeader title="Asset Camouflage" iconType="lock" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Unobtrusive Transfers & Private Settlement.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Operating as a closed-loop network with no public DEX liquidity pools. When you send or receive UFO in mainstream wallets, bystanders and automated trackers only see a transfer of a $0.00 asset.</p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(76,29,149,0.3)' }}>
              <CardHeader title="Strict 1:1 Peg to USD" iconType="shield" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Rigid USD peg. Stablecoins priced via Chainlink.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>UFO is rigidly pegged to the US Dollar. USDT and USDC are <b>not</b> treated as $1.00 — their live Chainlink USD prices are read on-chain by the Vault contract itself. If a stablecoin deviates more than 2% from $1, transactions revert automatically.</p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(180,83,9,0.3)' }}>
              <CardHeader title="Instant Settlement" iconType="zap" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>24/7 Global Fund Clearing.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Send money like a message. With UFO, cross-border funds arrive in the recipient's wallet within seconds, bypassing traditional banking delays.</p>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #4338ca, #6366f1)', padding: '24px', borderRadius: '24px', color: '#fff', boxShadow: '0 10px 30px -10px rgba(67,56,202,0.3)' }}>
              <CardHeader title="Security & Compliance" iconType="layers" />
              <h4 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '10px' }}>Cryptographically tamper-proof.</h4>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>Vault reserves are transparent and verifiable on BscScan. Every transaction is secured by blockchain-level cryptography.</p>
            </div>

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

            <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '40px' }}>
              
              <a href="https://x.com/ufodollar" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ width: '64px', height: '64px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#000000"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></svg>
                </div>
              </a>

              <a href="https://t.me/ufodollar" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ width: '64px', height: '64px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#000000"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" /></svg>
                </div>
              </a>

              <a href="https://youtube.com/@ufodollar" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ width: '64px', height: '64px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#000000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                </div>
              </a>

              <a href="https://github.com/ufodollar/bsc-vault" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ width: '64px', height: '64px', background: '#f8fafc', borderRadius: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#000000"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                </div>
              </a>

            </div>

            <div style={{ marginBottom: '32px', fontSize: '12px', color: '#94a3b8', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase' }}>UFO built by StoneX</div>

            <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <a href="mailto:ufodollar6@gmail.com" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  </div>
                  <div><div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Email Support</div><div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>ufodollar6@gmail.com</div></div>
                </div>
              </a>
              <div style={{ background: '#fff', padding: '20px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                </div>
                <div><div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Headquarters</div><div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', lineHeight: 1.4 }}>Ritter House, Wickhams Cay 2,<br />Road Town, Tortola, BVI</div></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        background: '#ffffff', borderTop: '1px solid #e2e8f0',
        padding: '8px 0 16px 0', zIndex: 20
      }}>
        {[
          { id: 'swap', label: 'Swap', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4" /><path d="M4 7h16" /><path d="M16 21l4-4-4-4" /><path d="M20 17H4" /></svg> },
          { id: 'assets', label: 'Wallet', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg> },
          { id: 'history', label: 'History', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          { id: 'rules', label: 'Rules', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> },
          { id: 'contact', label: 'Contact', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg> }
        ].map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: activeTab === tab.id ? '#0969da' : '#57606a', flex: 1, cursor: 'pointer' }}
          >
            <div style={{ transform: activeTab === tab.id ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s' }}>{tab.icon}</div>
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