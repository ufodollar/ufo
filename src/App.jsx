import React, { useState, useEffect, useCallback, useRef } from 'react';
// 首屏不引入 ethers：读链走 chain.js 的裸 JSON-RPC，
// 只有真正签名时才按需下载 ethers（见 tx.js）。体积对比见 README。
import { CONFIG } from './config';
import { formatUnits, parseUnits } from './units';
import { readNav, readPrice, readBnbPrice, readVaultBalances, readWalletSnapshot } from './chain';
import { submitSwap, toWei, prefetchTxLibs } from './tx';
import { useWallet } from './useWallet';
import WalletSetup from './components/WalletSetup';
import TokenMenu from './components/TokenMenu';

// 引入抽离出来的文案组件
// Guide = 产品说明（原 Rules 内容，已去除锚定/稳定币叙事）
// Rules = 兑换规则 / 钱包用法 / 风险提示解释
import GuideTab from './components/GuideTab';
import RulesTab from './components/RulesTab';

// ================= 1. 币种图标 =================
// Tether / Circle / Binance 官方 logo 的矢量路径，内联成 data URI。
// 不引用外部图床（assets.coingecko.com 在国内实测 20 秒超时），
// 也不用「字母 T / $」替代 —— 这里就是官方标志本身的形状。
const svgIcon = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg);

// USDT（Tether 官方现行标志：六边形绿底 #50AF95 + 白色 ₮）
// 2024 年 Tether 换过标，旧版是绿色圆形 + #26A17B，与官网已不一致。
// 六边形宽高比 339:295，viewBox 保持原比例，由 preserveAspectRatio 居中留白。
const ICON_USDT = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 339.43 295.27"><path fill="#50AF95" fill-rule="evenodd" d="M62.15,1.45l-61.89,130a2.52,2.52,0,0,0,.54,2.94L167.95,294.56a2.55,2.55,0,0,0,3.53,0L338.63,134.4a2.52,2.52,0,0,0,.54-2.94l-61.89-130A2.5,2.5,0,0,0,275,0H64.45a2.5,2.5,0,0,0-2.3,1.45h0Z"/><path fill="#fff" fill-rule="evenodd" d="M191.19,144.8v0c-1.2.09-7.4,0.46-21.23,0.46-11,0-18.81-.33-21.55-0.46v0c-42.51-1.87-74.24-9.27-74.24-18.13s31.73-16.25,74.24-18.15v28.91c2.78,0.2,10.74.67,21.74,0.67,13.2,0,19.81-.55,21-0.66v-28.9c42.42,1.89,74.08,9.29,74.08,18.13s-31.65,16.24-74.08,18.12h0Zm0-39.25V79.68h59.2V40.23H89.21V79.68H148.4v25.86c-48.11,2.21-84.29,11.74-84.29,23.16s36.18,20.94,84.29,23.16v82.9h42.78V151.83c48-2.21,84.12-11.73,84.12-23.14s-36.09-20.93-84.12-23.15h0Z"/></svg>');

// USDC（Circle 官方标志：蓝底白色 $ + 两侧弧线）
const ICON_USDC = svgIcon('<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><g fill="none"><circle fill="#2775CA" cx="16" cy="16" r="16"/><g fill="#FFF"><path d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.243-2.193-.728-2.193-1.578 0-.85.61-1.396 1.828-1.396 1.097 0 1.707.364 2.011 1.275a.458.458 0 00.427.303h.975a.416.416 0 00.427-.425v-.06a3.04 3.04 0 00-2.743-2.489V9.142c0-.243-.183-.425-.487-.486h-.915c-.243 0-.426.182-.487.486v1.396c-1.829.242-2.986 1.456-2.986 2.974 0 2.002 1.218 2.791 3.778 3.095 1.707.303 2.255.668 2.255 1.639 0 .97-.853 1.638-2.011 1.638-1.585 0-2.133-.667-2.316-1.578-.06-.242-.244-.364-.427-.364h-1.036a.416.416 0 00-.426.425v.06c.243 1.518 1.219 2.61 3.23 2.914v1.457c0 .242.183.425.487.485h.915c.243 0 .426-.182.487-.485V21.34c1.829-.303 3.047-1.578 3.047-3.217z"/><path d="M12.892 24.497c-4.754-1.7-7.192-6.98-5.424-11.653.914-2.55 2.925-4.491 5.424-5.402.244-.121.365-.303.365-.607v-.85c0-.242-.121-.424-.365-.485-.061 0-.183 0-.244.06a10.895 10.895 0 00-7.13 13.717c1.096 3.4 3.717 6.01 7.13 7.102.244.121.488 0 .548-.243.061-.06.061-.122.061-.243v-.85c0-.182-.182-.424-.365-.546zm6.46-18.936c-.244-.122-.488 0-.548.242-.061.061-.061.122-.061.243v.85c0 .243.182.485.365.607 4.754 1.7 7.192 6.98 5.424 11.653-.914 2.55-2.925 4.491-5.424 5.402-.244.121-.365.303-.365.607v.85c0 .242.121.424.365.485.061 0 .183 0 .244-.06a10.895 10.895 0 007.13-13.717c-1.096-3.46-3.778-6.07-7.13-7.162z"/></g></g></svg>');

// BNB（BNB Chain 官方现行标志：金黄 #F0B90B 圆底 + 菱形组合图案）
// 旧版是 #F3BA2F 圆底 + 单个白菱形（2021 年的币安图标），已被官方替换。
const ICON_BNB = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2496 2496"><path fill="#F0B90B" d="M1248,0c689.3,0,1248,558.7,1248,1248s-558.7,1248-1248,1248S0,1937.3,0,1248S558.7,0,1248,0L1248,0z"/><path fill="#FFFFFF" d="M685.9,1248l0.9,330l280.4,165v193.2l-444.5-260.7v-524L685.9,1248L685.9,1248z M685.9,918v192.3l-163.3-96.6V821.4l163.3-96.6l164.1,96.6L685.9,918L685.9,918z M1084.3,821.4l163.3-96.6l164.1,96.6L1247.6,918L1084.3,821.4L1084.3,821.4z"/><path fill="#FFFFFF" d="M803.9,1509.6v-193.2l163.3,96.6v192.3L803.9,1509.6L803.9,1509.6z M1084.3,1812.2l163.3,96.6l164.1-96.6v192.3l-164.1,96.6l-163.3-96.6V1812.2L1084.3,1812.2z M1645.9,821.4l163.3-96.6l164.1,96.6v192.3l-164.1,96.6V918L1645.9,821.4L1645.9,821.4L1645.9,821.4z M1809.2,1578l0.9-330l163.3-96.6v524l-444.5,260.7v-193.2L1809.2,1578L1809.2,1578L1809.2,1578z"/><polygon fill="#FFFFFF" points="1692.1,1509.6 1528.8,1605.3 1528.8,1413 1692.1,1316.4 1692.1,1509.6"/><path fill="#FFFFFF" d="M1692.1,986.4l0.9,193.2l-281.2,165v330.8l-163.3,95.7l-163.3-95.7v-330.8l-281.2-165V986.4L968,889.8l279.5,165.8l281.2-165.8l164.1,96.6H1692.1L1692.1,986.4z M803.9,656.5l443.7-261.6l444.5,261.6l-163.3,96.6l-281.2-165.8L967.2,753.1L803.9,656.5L803.9,656.5z"/></svg>');

const STABLECOINS = [
  { symbol: 'USDT', name: 'Tether USD', address: CONFIG.USDT_ADDRESS, icon: ICON_USDT },
  { symbol: 'USDC', name: 'USD Coin', address: CONFIG.USDC_ADDRESS, icon: ICON_USDC }
];

const UFO_TOKEN = { symbol: 'UFO', name: 'UFO Dollar', address: CONFIG.UFO_ADDRESS, icon: 'UFO' };

// ================= 2. 样式常量 =================
const FONT_STYLE = {
  fontFamily: '"Lora", "Noto Serif SC", "Songti SC", Georgia, "Times New Roman", serif'
};

/* Swap / Wallet / History 三个页面共用的白色容器，样式只在这里写一次 */
const HEAD_BTN = {
  appearance: 'none', WebkitAppearance: 'none', font: 'inherit', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '34px', height: '34px', padding: 0, borderRadius: '11px',
  background: '#fff', border: '1px solid #e2e8f0', color: '#334155',
  cursor: 'pointer', lineHeight: 1
};

const SUB_CARD = {
  background: '#fff',
  borderRadius: '24px',
  padding: '20px',
  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)',
  border: '1px solid #f1f5f9'
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

// ================= 3. 读链逻辑 =================
async function fetchVaultPrice(tokenAddress) {
  let lastError = null;

  for (let i = 0; i < 3; i++) {
    try {
      const price18 = await readPrice(tokenAddress);
      return {
        price18,
        priceFloat: Number(price18) / 1e18,
        isFallback: false
      };
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

async function fetchStablecoinPrices() {
  const [usdtResult, usdcResult] = await Promise.allSettled([
    fetchVaultPrice(CONFIG.USDT_ADDRESS),
    fetchVaultPrice(CONFIG.USDC_ADDRESS)
  ]);

  const result = {
    USDT: null,
    USDC: null,
    errors: [],
    source: 'vault',
    lastUpdated: Date.now(),
  };

  if (usdtResult.status === 'fulfilled') {
    result.USDT = usdtResult.value;
  } else {
    result.USDT = { price18: 10n ** 18n, priceFloat: 1.0, isFallback: true };
    const errMsg = usdtResult.reason?.reason || usdtResult.reason?.shortMessage || 'USDT RPC Failed';
    result.errors.push({ token: 'USDT', message: `USDT: ${errMsg}` });
  }

  if (usdcResult.status === 'fulfilled') {
    result.USDC = usdcResult.value;
  } else {
    result.USDC = { price18: 10n ** 18n, priceFloat: 1.0, isFallback: true };
    const errMsg = usdcResult.reason?.reason || usdcResult.reason?.shortMessage || 'USDC RPC Failed';
    result.errors.push({ token: 'USDC', message: `USDC: ${errMsg}` });
  }

  return result;
}

// ================= 4. 主应用 =================
function App() {
  // 只有一条路径：钱包本体就在这个页面里。
  // 没有注入式钱包、没有钱包墙、没有 WalletConnect —— 用户第一次来时
  // 在 Wallet 标签页生成一个，之后每次进来输 PIN 解锁（见 useWallet.js）。
  const {
    address, provider: walletProvider, isConnected,
    busy: walletBusy, hasWallet, accounts, activeId,
    create: createWallet, importKey, unlock: unlockWallet, lock: lockWallet,
    switchTo: switchAccount, viewKey, removeAccount, confirmBackup, fixChain
  } = useWallet();

  // '' | 'create' | 'import' | 'unlock' | 'viewkey' | 'accounts'
  const [walletPanel, setWalletPanel] = useState('');

  const [activeTab, setActiveTab] = useState('swap');
  const [isBuyingUFO, setIsBuyingUFO] = useState(true);
  // 顶部只显示「是第几个账户」，地址不在页面上出现（只在账户管理弹窗里）。
  const activeIdx = accounts.findIndex((a) => a.id === activeId);
  const accountNo = activeIdx >= 0 ? activeIdx + 1 : 1;

  const [selectedStablecoin, setSelectedStablecoin] = useState(STABLECOINS[0]);
  const [showTokenMenu, setShowTokenMenu] = useState(false);

  const [vaultBalances, setVaultBalances] = useState({ USDT: 0, USDC: 0 });

  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('0.000000');
  const [feeAmount, setFeeAmount] = useState('0.000000');

  const [currentNav, setCurrentNav] = useState(1);
  const [navStatus, setNavStatus] = useState('loading'); 

  const [bnbPrice, setBnbPrice] = useState(null);

  // 未连接钱包时也展示真实 BNB 价格。此前初始值是硬编码的 600，
  // 在真实价格约 575 的行情下等于展示假数据，金融产品不能这么做。
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const price = await readBnbPrice();
        if (alive) setBnbPrice(price);
      } catch (e) {
        // 预言机不可达时保持占位符，不编造价格
      }
    })();
    return () => { alive = false; };
  }, []);

  const [stablecoinPrices, setStablecoinPrices] = useState({
    USDT: { price18: 10n ** 18n, priceFloat: 1.0, isFallback: false },
    USDC: { price18: 10n ** 18n, priceFloat: 1.0, isFallback: false },
    errors: [],
    source: 'vault',
    lastUpdated: null,
  });

  const [bnbBal, setBnbBal] = useState('0.000000');
  const [tokenBalances, setTokenBalances] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [txMsg, setTxMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [history, setHistory] = useState([]);

  const priceRefreshingRef = useRef(false);
  const balanceRefreshingRef = useRef(false);
  // errorMsg 有两个来源，语义完全不同，不能一视同仁地拦按钮：
  //   · 校验类（余额不足、价格偏差、金额非法）→ 必须拦，否则用户白签一笔会 revert 的交易；
  //   · 交易类（用户在钱包里点了拒绝、gas 不足、上链失败）→ 不能拦，因为
  //     用户再点一次按钮的意思就是「我知道了，再试一次」，拦住等于按钮失灵。
  // 旧代码用 `|| errorMsg` 一刀切，导致被拒一次之后再点毫无反应 —— 这个
  // 现象很难归因，用户只会说「按钮坏了」。
  const txErrorRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem('ufo_tx_history');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      // 早期版本只写字符串、或者写到一半被中断，都可能留下非数组。
      // 旧代码直接 setHistory(parsed)，History 标签一渲染 .map 就抛，
      // 整棵树被卸载 —— 这本身就是一条「点开就崩」的路径。
      if (Array.isArray(parsed)) {
        setHistory(parsed.filter((x) => x && typeof x === 'object'));
      } else {
        localStorage.removeItem('ufo_tx_history');
      }
    } catch (e) {
      try { localStorage.removeItem('ufo_tx_history'); } catch (err) { /* noop */ }
    }
  }, []);

  // 用函数式更新：这里曾经读的是渲染时闭包里的 history，
  // 连续两笔交易时后一笔会把前一笔覆盖掉。
  const saveTxToHistory = (txRecord) => {
    setHistory(prev => {
      const next = [txRecord, ...prev].slice(0, 50);
      try { localStorage.setItem('ufo_tx_history', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const ensureBscNetwork = useCallback(async () => {
    // 本地钱包的 chainId 固定是 0x38，切换请求恒成功。
    // 保留这一层是为了让 submitSwap 的调用方式不因钱包形态而分叉。
    return fixChain();
  }, [fixChain]);

  useEffect(() => {
    if (!isConnected || !walletProvider) return;
    ensureBscNetwork();
    // 用户在钱包里手动切到别的网络时，立刻请求切回 BSC
    const onChainChanged = () => { ensureBscNetwork(); };
    try { walletProvider.on?.('chainChanged', onChainChanged); } catch (e) {}
    return () => { try { walletProvider.removeListener?.('chainChanged', onChainChanged); } catch (e) {} };
  }, [isConnected, walletProvider, ensureBscNetwork]);

  const fetchNav = useCallback(async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const nav = await readNav();
        if (!isFinite(nav) || nav <= 0) throw new Error("Invalid NAV");
        setCurrentNav(nav);
        setNavStatus('ready');
        return;
      } catch (err) {
        if (i === 2) setNavStatus('error');
        else await new Promise(r => setTimeout(r, 1000));
      }
    }
  }, []);

  useEffect(() => {
    fetchNav();
    // 页面在后台时不轮询：手机上几十个标签页并存，每 30 秒一次 RPC
    // 没有任何收益，只会在内存吃紧时把渲染进程推到崩溃边缘。
    const interval = setInterval(() => { if (!document.hidden) fetchNav(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchNav]);

  const refreshPrices = useCallback(async () => {
    if (priceRefreshingRef.current) return;
    priceRefreshingRef.current = true;
    try {
      const prices = await fetchStablecoinPrices();
      setStablecoinPrices(prices);
    } catch (err) {
      setStablecoinPrices(prev => ({
        ...prev,
        errors: [{ token: 'GLOBAL', message: 'Network error. Please check your connection.' }],
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
      setVaultBalances(await readVaultBalances());
    } catch (error) {
      console.warn('[ufo] vault balances unavailable:', error && error.message);
    } finally {
      balanceRefreshingRef.current = false;
    }
  }, []);

  const fetchUserBalances = useCallback(async () => {
    if (!address) return;
    try {
      const snap = await readWalletSnapshot(address);

      if (snap.bnb !== null) setBnbBal(snap.bnb.toFixed(6));
      if (snap.bnbPrice !== null) setBnbPrice(snap.bnbPrice);

      const next = {};
      for (const token of [...STABLECOINS, UFO_TOKEN]) {
        const v = snap[token.symbol];
        next[token.symbol] = v === null ? '0.000000' : v.toFixed(6);
      }
      setTokenBalances(next);
    } catch (error) {
      console.warn('[ufo] wallet balances unavailable:', error && error.message);
    }
  }, [address]);

  useEffect(() => {
    refreshPrices();
    fetchVaultBalances();
    const interval = setInterval(() => {
      if (document.hidden) return;
      refreshPrices();
      fetchVaultBalances();
    }, 8000);
    return () => clearInterval(interval);
  }, [refreshPrices, fetchVaultBalances]);

  useEffect(() => {
    if (!isConnected || !address) {
      setTokenBalances({});
      setBnbBal('0.000000');
      return;
    }
    fetchUserBalances();
    const interval = setInterval(() => { if (!document.hidden) fetchUserBalances(); }, 10000);
    return () => clearInterval(interval);
    // activeTab 一起进依赖：每次切到 Wallet / History 都立刻拉一次，不用等下一个 10 秒
  }, [isConnected, address, fetchUserBalances, activeTab]);

  // 断开之后把上一个会话的残留清干净。
  //
  // 旧版本只把 account 置空，金额输入框、错误提示、交易结果都还留着 ——
  // 那些内容属于一个已经不存在的地址。用户接着点按钮，走的是
  // 「未连接 → 重新弹授权」，而他以为自己在继续上一笔。
  useEffect(() => {
    if (isConnected) return;
    setInputAmount('');
    setTxMsg('');
    setErrorMsg('');
    setShowTokenMenu(false);
    txErrorRef.current = false;
  }, [isConnected]);

  // 回到前台补一次：后台期间三个轮询都停着，切回来不能还显示十分钟前的余额。
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      refreshPrices();
      fetchVaultBalances();
      fetchUserBalances();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshPrices, fetchVaultBalances, fetchUserBalances]);

  const currentPriceData = selectedStablecoin.symbol === 'USDT' ? stablecoinPrices.USDT : stablecoinPrices.USDC;
  const currentPriceError = stablecoinPrices.errors.find(e => e.token === selectedStablecoin.symbol);
  const globalPriceError = stablecoinPrices.errors.find(e => e.token === 'GLOBAL');
  const priceReady = !!currentPriceData && !globalPriceError;

  useEffect(() => {
    const input = parseFloat(inputAmount);
    // 每次重新计算都把「上一次交易失败」的标记清掉：只要输入或价格变了，
    // 旧的失败结论就不再适用，不该继续影响按钮。
    txErrorRef.current = false;
    // 已经开始输金额，就说明下一秒可能要签交易了 —— 此刻把 ethers 拉下来，
    // 等真正点按钮时不必再等 100KB 的下载
    if (isConnected && input > 0) prefetchTxLibs();
    if (isNaN(input) || input <= 0 || !isFinite(input)) {
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      setErrorMsg('');
      return;
    }

    if (globalPriceError) {
      setErrorMsg('Network error. Please retry.');
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      return;
    }

    // 价格数据没到手时不要往下算：currentPriceData 可能是 null（比如
    // 两个稳定币的报价都没读回来），旧代码在这里直接取 price18 会抛，
    // 抛在 effect 里就会把整棵 React 树卸载 —— 表现和「页面崩溃」一样。
    const price18 = currentPriceData && currentPriceData.price18;
    if (!price18) {
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      return;
    }
    const deviation = price18 > 10n ** 18n ? price18 - 10n ** 18n : 10n ** 18n - price18;
    if (Number(deviation * 10000n / 10n ** 18n) > CONFIG.MAX_PRICE_DEVIATION * 10000) {
      setErrorMsg(`${selectedStablecoin.symbol} price deviation exceeds 2%. Trading paused.`);
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      return;
    }

    // 输入金额清洗：末尾小数点（"1."）会让 parseUnits 报错；
    // 科学计数法（"1e5"，number 输入框允许）同样会抛异常 —— 一旦在 effect 里抛出，
    // 整棵 React 树会被卸载，页面直接变成不可交互的白屏。这里兜住并提示。
    const cleanInput = inputAmount.toString().replace(/\.$/, '');
    let inputWei;
    try {
      inputWei = parseUnits(cleanInput || '0', 18);
    } catch (err) {
      setErrorMsg('Invalid amount');
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      return;
    }

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

      setFeeAmount(parseFloat(formatUnits(feeUsd, 18)).toFixed(6));
      setOutputAmount(parseFloat(formatUnits(ufoAmount, 18)).toFixed(6));
    } else {
      const feeUfo = (inputWei * 50n) / 10000n;
      // 1 UFO = 1 USD 面值，因此 UFO 计价的费用数值上等于 USD 金额
      const feeUsd = feeUfo;
      const netUfo = inputWei - feeUfo;
      const tokenOut = (netUfo * 10n ** 18n) / price18;
      // 合约实际转出 = 净额 + 以稳定币扣除的手续费（与 withdraw() 的 totalOut 对齐）
      const feeTokens = (feeUfo * 10n ** 18n) / price18;
      const totalOut = tokenOut + feeTokens;

      const currentVaultBal = vaultBalances[selectedStablecoin.symbol] || 0;
      const tokenOutFloat = parseFloat(formatUnits(totalOut, 18));
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

      setFeeAmount(parseFloat(formatUnits(feeUsd, 18)).toFixed(6));
      setOutputAmount(parseFloat(formatUnits(tokenOut, 18)).toFixed(6));
    }
  }, [inputAmount, isBuyingUFO, tokenBalances, isConnected, selectedStablecoin, vaultBalances, currentPriceData, currentPriceError, globalPriceError]);

  const handleAction = async () => {
    if (isProcessing) return;
    // 没有钱包就先生成/解锁，而不是「连接」。这是本页唯一的账户来源。
    if (!isConnected || !walletProvider) {
      setWalletPanel(hasWallet ? 'unlock' : 'create');
      return;
    }

    const isNetworkOk = await ensureBscNetwork();
    if (!isNetworkOk) return;

    const input = parseFloat(inputAmount);
    if (!inputAmount || input <= 0 || isNaN(input)) return;
    // 只让「校验类」错误拦住提交；交易类错误放行，让用户能重试。
    if (errorMsg && !txErrorRef.current) return;
    txErrorRef.current = false;

    if (!priceReady) {
      setErrorMsg('Price feed not ready. Please wait or refresh.');
      return;
    }

    setIsProcessing(true);
    setTxMsg('');
    setErrorMsg('');

    const currentTime = new Date().toLocaleString();
    const txRecord = {
      time: currentTime,
      type: isBuyingUFO ? 'Issuance' : 'Burn',
      payAmount: inputAmount,
      paySymbol: isBuyingUFO ? selectedStablecoin.symbol : 'UFO',
      receiveAmount: outputAmount,
      receiveSymbol: isBuyingUFO ? 'UFO' : selectedStablecoin.symbol,
      status: 'Pending',
      txHash: ''
    };

    try {
      // ethers 在这一刻才被下载，且只在第一次点按钮时发生
      const result = await submitSwap({
        walletProvider,
        owner: address,
        tokenAddress: selectedStablecoin.address,
        amountWei: toWei(inputAmount),
        isBuy: isBuyingUFO,
        onStage: setTxMsg
      });

      txRecord.txHash = result.hash;
      txRecord.payAmount = result.paid;
      if (result.received) txRecord.receiveAmount = result.received;
      txRecord.status = 'Success';
      setTxMsg(isBuyingUFO ? 'Issuance cleared.' : 'Burn cleared.');

      saveTxToHistory(txRecord);
      setInputAmount('');
      setOutputAmount('0.000000');
      setFeeAmount('0.000000');
      fetchUserBalances();
      fetchVaultBalances();
      fetchNav();

    } catch (error) {
      console.warn('[ufo] transaction failed:', error && error.message);
      txErrorRef.current = true;
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

  return (
    <div style={{ ...FONT_STYLE, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative', backgroundColor: '#f8fafc', color: '#1e293b' }}>

      {/* 装饰光斑：纯视觉，必须让点击穿透，否则会盖在内容上吞掉点击 */}
      <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '250px', height: '250px', background: '#bfdbfe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '50px', right: '-50px', width: '250px', height: '250px', background: '#ddd6fe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0, pointerEvents: 'none' }}></div>

      {/* Header */}
      {/* zIndex 必须高于主内容(10)和底栏(20)：header 和主内容是兄弟节点，
          同级时后渲染的会盖住前面的，账户菜单就会被 Swap 卡片压住 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', zIndex: 30, flexShrink: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '40px', background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <UfoIcon size={28} />
          </div>
          <span style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.5px' }}>UFO<span style={{ color: '#3b82f6' }}> Dollar</span></span>
        </div>
        {/* 右上角：账户号 → 锁定 → 账户管理。
            账户号只显示「是第几个」，不再显示地址尾号；地址只在账户管理里出现。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isConnected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '34px',
                            background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                            padding: '0 11px', borderRadius: '17px', fontWeight: 700, fontSize: '12.5px',
                            lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                Account {accountNo}
              </div>
              <button
                onClick={lockWallet}
                aria-label="Lock wallet"
                title="Lock wallet"
                style={HEAD_BTN}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10.5" width="16" height="10.5" rx="2.2" />
                  <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => setWalletPanel(hasWallet ? 'unlock' : 'create')}
              disabled={walletBusy}
              style={{ appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
                       background: walletBusy ? '#93c5fd' : '#3b82f6', color: '#fff', border: 'none',
                       padding: '8px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '12.5px',
                       lineHeight: 1.2, cursor: walletBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                       boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
            >
              {walletBusy ? 'Working…' : hasWallet ? 'Unlock' : 'Create Wallet'}
            </button>
          )}

          <button
            onClick={() => setWalletPanel('accounts')}
            aria-label="Accounts"
            title="Accounts"
            style={HEAD_BTN}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h10M4 12h16M4 17h7" />
              <circle cx="18" cy="7" r="2.2" />
              <circle cx="14" cy="17" r="2.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch', overflowY: 'auto', padding: '0 20px 85px 20px', zIndex: 10 }}>

        {activeTab === 'swap' && (
          <div style={{ ...SUB_CARD, marginTop: '10px' }}>
            <h3 style={{ textAlign: 'center', fontSize: '18px', fontWeight: '700', marginBottom: '18px', lineHeight: 1.35 }}>Self-service issuance machine</h3>

            {currentPriceError && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', marginBottom: '16px', fontWeight: '600', color: '#ef4444' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                {currentPriceError.message}
              </div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: '600' }}>
                <span>You Pay</span>
                <span>Balance: {isConnected ? ((isBuyingUFO ? tokenBalances[selectedStablecoin.symbol] : tokenBalances['UFO']) || '0.000000') : '0.000000'}</span>
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
                    <TokenMenu
                      mode="buy"
                      coins={STABLECOINS}
                      prices={stablecoinPrices}
                      vaultBalances={vaultBalances}
                      onClose={() => setShowTokenMenu(false)}
                      onSelect={(coin) => { setSelectedStablecoin(coin); setShowTokenMenu(false); setInputAmount(''); }}
                    />
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
                <span>You Receive</span>
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
                    <TokenMenu
                      mode="sell"
                      coins={STABLECOINS}
                      prices={stablecoinPrices}
                      vaultBalances={vaultBalances}
                      onClose={() => setShowTokenMenu(false)}
                      onSelect={(coin) => { setSelectedStablecoin(coin); setShowTokenMenu(false); setInputAmount(''); }}
                    />
                  )}
                </div>
              </div>

              {!isBuyingUFO && parseFloat(inputAmount) > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', fontSize: '13px', color: '#64748b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>USDT Pool:</span>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{Number(vaultBalances.USDT || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>USDC Pool:</span>
                    <span style={{ fontWeight: '600', color: '#1e293b' }}>{Number(vaultBalances.USDC || 0).toFixed(2)}</span>
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
                <span>UFO Price (on-chain)</span>
                <span>
                  1 UFO = ${currentNav.toFixed(4)} USD
                  {navStatus === 'error' && <span style={{ marginLeft: 6 }}>(read failed)</span>}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#ef4444', marginBottom: '6px' }}>
                <span>{isBuyingUFO ? 'Issuance fee (0.5%)' : 'Burn fee (0.5%)'}</span>
                <span>-{feeAmount} USD</span>
              </div>

            </div>

            {txMsg && (
              <div style={{ marginTop: '15px', padding: '10px', textAlign: 'center', background: txMsg.includes('cleared') ? '#ecfdf5' : '#eff6ff', color: txMsg.includes('cleared') ? '#10b981' : '#3b82f6', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>{txMsg}</div>
            )}

            <button
              onClick={handleAction}
              disabled={isButtonDisabled}
              style={{ ...FONT_STYLE, width: '100%', padding: '16px', background: isButtonDisabled ? '#94a3b8' : '#3b82f6', color: '#fff', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '700', cursor: isButtonDisabled ? 'not-allowed' : 'pointer', marginTop: '20px', boxShadow: isButtonDisabled ? 'none' : '0 8px 20px -5px rgba(59,130,246,0.4)' }}
            >
              {isProcessing ? 'Processing...'
                : !isConnected ? (hasWallet ? 'Unlock Wallet' : 'Create Wallet')
                : (isBuyingUFO ? 'Issuance' : 'Burn')}
            </button>
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{ marginTop: '10px' }}>
          <div style={{ ...SUB_CARD }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={ICON_BNB} style={{ width: 40, height: 40 }} alt="BNB" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700' }}>BNB</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>{bnbPrice == null ? '—' : '$' + formatPrice(bnbPrice, true)}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Pays the gas</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? bnbBal : '0.000000'}</span>
                <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace', marginTop: '2px' }}>{bnbPrice == null ? '≈ —' : '≈ $' + formatUsd(Number(bnbBal) * bnbPrice)}</span>
              </div>
            </div>

            {[...STABLECOINS, UFO_TOKEN].map((token, index, arr) => {
              let currentPrice = 1.0;
              let isFallback = false;
              if (token.symbol === 'UFO') {
                currentPrice = currentNav;
                isFallback = navStatus === 'error';
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
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: '700' }}>{token.symbol}</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: isFallback ? '#ef4444' : '#64748b' }}>
                          ${formatPrice(currentPrice)}{isFallback && '*'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{token.name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ ...FONT_STYLE, fontSize: '18px', fontWeight: '700' }}>{isConnected ? tokenBalances[token.symbol] || '0.000000' : '0.000000'}</span>
                    <span style={{ fontSize: '13px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace', marginTop: '2px' }}>
                      ≈ ${formatUsd(Number(tokenBalances[token.symbol] || 0) * currentPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ marginTop: '10px' }}>
            {/* 页头。链上明细的入口放这里：钱包页已经不再展示地址， */}
            {/* 想知道这个账户在链上发生过什么，就来 History 的右上角。 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px',
                          marginBottom: '16px', padding: '0 4px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', letterSpacing: '-0.3px' }}>
                  UFO Chain History
                </h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '5px', lineHeight: 1.6 }}>
                  Every line below leads to the chain itself.
                </p>
              </div>
              {isConnected && (
                <a
                  href={`https://bscscan.com/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '5px',
                           height: '32px', padding: '0 11px', borderRadius: '10px',
                           border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8',
                           fontSize: '11.5px', fontWeight: 700, lineHeight: 1.2, textDecoration: 'none',
                           whiteSpace: 'nowrap' }}
                >
                  BscScan
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17 17 7" /><path d="M8 7h9v9" />
                  </svg>
                </a>
              )}
            </div>

            <div style={SUB_CARD}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#334155' }}>Local Ledger</h3>
                {history.length > 0 && (
                  <button onClick={clearHistory} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                    Clear All
                  </button>
                )}
              </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px auto' }}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p style={{ fontSize: '14px' }}>Nothing yet. Each issuance you make will be written here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((tx, idx) => (
                  <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: (tx.type === 'Issuance' || tx.type === 'Swap') ? '#3b82f6' : '#8b5cf6' }}>{tx.type}</span>
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
                      <a
                        href={`https://bscscan.com/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: '8px', fontSize: '11px', color: '#64748b', wordBreak: 'break-all', textDecoration: 'none', borderBottom: '1px dashed #cbd5e1' }}
                      >
                        {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-8)} ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        )}

        {/* 抽离出的文案组件 */}
        {activeTab === 'guide' && <GuideTab />}
        {activeTab === 'rules' && <RulesTab />}

        {activeTab === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Write to us</h2>
            <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '40px', maxWidth: '300px' }}>Our channels, and the address behind them. A person answers.</p>

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

      {/* Bottom Nav：absolute 而非 fixed —— 相对 #root 停靠，
          桌面宽屏下不会横跨整个视口（#root 有 max-width 480px） */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        background: '#ffffff', borderTop: '1px solid #e2e8f0',
        padding: '8px 0 16px 0', zIndex: 20
      }}>
        {[
          { id: 'swap', label: 'Issuance', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3L4 7l4 4" /><path d="M4 7h16" /><path d="M16 21l4-4-4-4" /><path d="M20 17H4" /></svg> },
          { id: 'assets', label: 'Wallet', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg> },
          { id: 'guide', label: 'Guide', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H2z" /><path d="M22 4.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H22z" /></svg> },
          { id: 'rules', label: 'Rules', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="8.5 14.5 10.8 16.8 15.5 12" /></svg> },
          { id: 'history', label: 'History', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3.2 1.9" /></svg> },
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

      <WalletSetup
        mode={walletPanel}
        onClose={() => setWalletPanel('')}
        onNavigate={(m) => setWalletPanel(m)}
        address={address}
        accounts={accounts}
        activeId={activeId}
        hasWallet={hasWallet}
        unlocked={isConnected}
        onCreate={createWallet}
        onImport={importKey}
        onUnlock={unlockWallet}
        onViewKey={viewKey}
        onSwitch={switchAccount}
        onRemove={removeAccount}
        onBackedUp={confirmBackup}
      />

    </div>
  );
}

// 渲染期异常兜底：任何组件抛错都不会让整页变成白屏，
// 而是给出可点击的重新加载入口（生产环境必须有这一层）。
//
// 这里同时承担「诊断」职责。之前崩溃页只说 "The page broke."，
// 用户在手机上没有任何控制台，我们拿不到任何线索，只能靠猜。
// 现在把错误原文、出错组件栈的第一行、页面地址一起显示出来 ——
// 一张截图就能定位。同时写进 sessionStorage，刷新后仍然可读。
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: '', frame: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      failed: true,
      message: (error && (error.name ? error.name + ': ' : '') + (error.message || String(error))) || 'Unknown error'
    };
  }

  componentDidCatch(error, info) {
    console.warn('[ufo] render error:', error && error.message);
    let frame = '';
    try {
      const stack = String((error && error.stack) || '').split('\n');
      // 跳过第一行（重复 message），取第一条带地址的帧
      frame = stack.find((l) => /https?:\/\/|\.js/i.test(l) && !/^[A-Za-z]*Error/.test(l.trim())) || '';
      frame = frame.trim().replace(/^at\s+/, '').slice(0, 180);
    } catch (e) { /* noop */ }

    this.setState({ frame });
    try {
      sessionStorage.setItem('ufo_last_crash', JSON.stringify({
        at: new Date().toISOString(),
        msg: String((error && error.message) || error).slice(0, 300),
        frame,
        componentStack: String((info && info.componentStack) || '')
          .split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2)
          .map((l) => l.replace(/^at\s+/, '').replace(/\s+/g, ' '))
          .join(' ← ').slice(0, 240),
        href: location.href.slice(0, 200)
      }));
    } catch (e) { /* 无痕模式 */ }
  }

  render() {
    if (!this.state.failed) return this.props.children;

    let last = null;
    try {
      const raw = sessionStorage.getItem('ufo_last_crash');
      if (raw) last = JSON.parse(raw);
    } catch (e) { /* noop */ }

    return (
      <div style={{
        minHeight: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '14px',
        padding: '40px 24px', textAlign: 'center',
        background: '#f8fafc', color: '#1e293b'
      }}>
        <div style={{ fontSize: '15px', fontWeight: 700 }}>The page broke.</div>
        <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.7, maxWidth: '320px' }}>
          Reload it. Your wallet stays on this device — you will only need your PIN again.
        </div>

        <div style={{
          maxWidth: '340px', width: '100%', textAlign: 'left', background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px',
          fontSize: '10.5px', lineHeight: 1.6, color: '#64748b', wordBreak: 'break-word'
        }}>
          <div style={{ fontWeight: 700, color: '#475569', marginBottom: '4px' }}>What happened</div>
          <div style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{this.state.message || (last && last.msg) || '—'}</div>
          {(this.state.frame || (last && last.frame)) && (
            <div style={{ fontFamily: 'monospace', marginTop: '4px', color: '#94a3b8' }}>at {this.state.frame || last.frame}</div>
          )}
          {(last && last.componentStack) && (
            <div style={{ marginTop: '4px', color: '#94a3b8' }}>in {last.componentStack}</div>
          )}
          {location.pathname !== '/' && (
            <div style={{ marginTop: '4px', color: '#cbd5e1' }}>{location.pathname}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => this.setState({ failed: false, message: '', frame: '' })}
            style={{
              marginTop: '4px', padding: '10px 20px', borderRadius: '22px',
              border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '4px', padding: '10px 24px', borderRadius: '22px', border: 'none',
              background: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default Root;
