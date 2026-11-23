import React, { useState, useEffect, useCallback, useRef } from 'react';
// 首屏不引入 ethers：读链走 chain.js 的裸 JSON-RPC，
// 只有真正签名时才按需下载 ethers（见 tx.js）。体积对比见 README。
import { CONFIG } from './config';
import { formatUnits, parseUnits } from './units';
import {
  readNav, readPrice, readBnbPrice, readVaultBalances,
  readTokenBalances, readTokenPrices, readDecimals, quotePancake, PANCAKE_ROUTER
} from './chain';
import { submitSwap, submitPancakeSwap, prefetchTxLibs } from './tx';
import { useWallet } from './useWallet';
import WalletSetup from './components/WalletSetup';
import TokenPicker from './components/TokenPicker';
import TransferSheet from './components/TransferSheet';
import ReadmeTab from './components/ReadmeTab';
import { TokenIcon, UfoIcon } from './icons';
import { TOKENS, TOKEN_BY_SYMBOL, UFO_TOKEN, isStable, isVaultPair, formatAmount, formatTokenAmount } from './tokens';
import { skyBtn, skyLink } from './ui';

// Guide 与 Rules 合并成一个 Readme 页，页内顶部切换（见 ReadmeTab）。
// 两份文案本身不动：它们是按条引用的条款，拆开写才不会被互相稀释。

// ================= 2. 样式常量 =================
const FONT_STYLE = {
  fontFamily: '"Lora", "Noto Serif SC", "Songti SC", Georgia, "Times New Roman", serif'
};

/* Swap / Wallet / History 三个页面共用的白色容器，样式只在这里写一次 */
// 头部操作按钮：天蓝底、白字、比原来大一档。
// 合并之后只剩两个：Lock 与 Account N。后者既是身份也是账户管理入口
// （原来是「Account 3」只读标签 + 一个 Accounts 按钮，同一件事占两个位置）。
// 几何与配色来自 ui.js —— 全站所有按钮共用同一套，不再各处手写。
const SKY_BTN = { ...skyBtn('md'), height: '38px', fontSize: 'clamp(11px, 3vw, 12.5px)', padding: '0 clamp(9px, 2.8vw, 13px)' };

// 闪兑面板的配色：与截图同源的一套中性灰 + 天蓝
const SWAP_TINT = {
  card: '#f4f5f7',
  ink: '#0f172a',
  mute: '#98a2b3',
  line: '#e9ecf1',
  accent: '#38bdf8'
};

// 闪兑面板自己的字体：金额和按钮一律无衬线。全站的 Lora 衬线是品牌调性，
// 但交易所面板里的「0」和「Swap」用衬线会显得像公告，也不利于对齐位数。
const UI_FONT = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  WebkitFontSmoothing: 'antialiased'
};

/* 代币胶囊：白底圆角、图标 + 代码 + 折叠箭头，两张卡片共用 */
function TokenChip({ token, size = 28, chevron = true, onClick }) {
  const clickable = typeof onClick === 'function';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      style={{
        appearance: 'none', WebkitAppearance: 'none', font: 'inherit',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#fff', border: 'none', borderRadius: '22px',
        padding: '5px 12px 5px 5px', cursor: clickable ? 'pointer' : 'default',
        boxShadow: '0 1px 3px rgba(16,24,40,0.07)', flexShrink: 0
      }}
    >
      <TokenIcon token={token} size={size} />
      <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.2px', color: SWAP_TINT.ink }}>
        {token.symbol}
      </span>
      {chevron && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#667085"
             strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      )}
    </button>
  );
}

const SUB_CARD = {
  background: '#fff',
  borderRadius: '24px',
  padding: '20px',
  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.06)',
  border: '1px solid #f1f5f9'
};

// 空报价。这是只读常量：每次更新都必须新建对象，别就地改字段 ——
// 就地改不会触发重渲染，界面会停在上一笔的数字上。
const EMPTY_QUOTE = {
  out: '0.000000', fee: '0.000000',
  amountInWei: 0n, minOutWei: 0n,
  path: null, kind: 'vault', hops: 1, loading: false
};

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
  // '' | 'send' | 'receive'
  const [transferMode, setTransferMode] = useState('');

  const [activeTab, setActiveTab] = useState('assets');
  // 闪兑两侧的代币，用 symbol 存。存对象会在每次读余额后被替换成新引用，
  // 「显示的币」和「提交的币」就有机会不是同一个 —— 那是最难查的一类 bug。
  const [paySym, setPaySym] = useState('USDT');
  const [recvSym, setRecvSym] = useState('UFO');
  // 顶部只显示账户编号，地址不在页面上出现（只在账户管理弹窗里）。
  // 编号取记录里的 a.no，永远不用数组下标：删掉账户 1 之后账户 2 仍叫账户 2。
  const addrKey = (address || '').toLowerCase();
  const activeAcct =
    accounts.find((a) => a.id === activeId) ||
    (addrKey ? accounts.find((a) => a.address.toLowerCase() === addrKey) : null) ||
    null;
  const accountNo = activeAcct ? activeAcct.no : null;

  // '' | 'pay' | 'receive' —— 点哪一侧的胶囊，弹窗就替哪一侧选币
  const [pickerSide, setPickerSide] = useState('');

  const [vaultBalances, setVaultBalances] = useState({ USDT: 0, USDC: 0 });

  const [inputAmount, setInputAmount] = useState('');
  // 报价是一次异步结果（Pancake 那条路要问链），所以整包存在一个对象里：
  // 输出数量、手续费、路径、最小到账、成交额。拆成五个 state 会出现
  // 「输出已经更新、路径还是上一对币」这种半新半旧的画面。
  const [quote, setQuote] = useState(EMPTY_QUOTE);

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

  // 全部代币的余额（含 BNB），键是 symbol
  const [tokenBalances, setTokenBalances] = useState({});
  // 链上真实精度。代币表里的 decimals 只是占位，DOGE 这类 8 位的币
  // 按 18 位换算会差 10^10 倍 —— 报价和成交都必须用这里读回来的值。
  const [tokenDecimals, setTokenDecimals] = useState({});
  // 链上询价结果（symbol → USD）。没询到的币不写默认值，
  // 界面上显示 "—" 而不是把它当成 0 美元。
  const [prices, setPrices] = useState({});

  // 价格表只在数值真的变了才换引用。轮询会把同一批数字重复写回来，
  // 每次都生成新对象的话，依赖 prices 的 effect 会被无意义地重跑。
  const mergePrices = useCallback((map) => {
    if (!map || !Object.keys(map).length) return;
    setPrices((prev) => {
      const changed = Object.keys(map).some((k) => prev[k] !== map[k]);
      return changed ? { ...prev, ...map } : prev;
    });
  }, []);
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

  // ---- 闪兑的两枚代币与路由 ----
  // 路由规则只有一条：一端是 UFO、另一端是 USDT/USDC 时走金库（按 NAV 结算），
  // 其余任意币对走 PancakeSwap。isVaultPair 就是这条规则的唯一实现，
  // 界面上的路径文案和真正提交的合约都读它，不可能各说各话。
  const payToken = TOKEN_BY_SYMBOL[paySym] || TOKEN_BY_SYMBOL.USDT;
  const receiveToken = TOKEN_BY_SYMBOL[recvSym] || UFO_TOKEN;
  const vaultRoute = isVaultPair(payToken, receiveToken);
  // 金库那一侧一定是稳定币（isVaultPair 已保证），它的报价与偏差检查都来自金库
  const vaultStable = vaultRoute ? (paySym === 'UFO' ? receiveToken : payToken) : null;
  const stablePriceData = vaultStable ? stablecoinPrices[vaultStable.symbol] : null;
  const stablePriceError = vaultStable
    ? stablecoinPrices.errors.find((e) => e.token === vaultStable.symbol)
    : null;
  const globalPriceError = stablecoinPrices.errors.find((e) => e.token === 'GLOBAL');
  const decIn = tokenDecimals[paySym] || payToken.decimals || 18;
  const decOut = tokenDecimals[recvSym] || receiveToken.decimals || 18;

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
      const bal = await readTokenBalances(address, TOKENS);
      setTokenBalances(bal);

      // 精度和余额同源：readDecimals 有 localStorage 记忆，第二次以后不再发请求
      try {
        const decOf = await readDecimals(TOKENS);
        const decs = {};
        TOKENS.forEach((t) => { decs[t.symbol] = decOf(t); });
        setTokenDecimals(decs);
      } catch (e) { /* 用代币表的声明值兜底 */ }

      // 只给「真的持有」的币询价。余额为 0 的币估值必然是 0，
      // 为它们各发一次 getPair + getReserves 是纯粹的浪费。
      const held = TOKENS.filter((t) => Number(bal[t.symbol] || 0) > 0);
      if (!held.length) return;
      try {
        const map = await readTokenPrices(held);
        mergePrices(map);
      } catch (e) { /* 取不到价就保留上一轮的值，界面显示 — */ }
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
      setPrices({});
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
    setPickerSide('');
    txErrorRef.current = false;
  }, [isConnected]);

  // 闪兑页的两个币也要有美元价。用户不一定持有它们（比如拿 BNB 换 USDT），
  // 而钱包页那套询价只覆盖「真的持有」的币 —— 不补这一层，面板上的
  // 「≈ $」就会空着，或者退回去用预言机价、和上面的汇率对不上。
  useEffect(() => {
    if (activeTab !== 'trade') return undefined;
    const need = [payToken, receiveToken].filter((t) =>
      t && t.symbol !== 'UFO' && !isStable(t.symbol) && prices[t.symbol] == null
    );
    if (!need.length) return undefined;
    let alive = true;
    readTokenPrices(need)
      .then((m) => { if (alive) mergePrices(m); })
      .catch(() => { /* 拿不到就显示 "—" */ });
    return () => { alive = false; };
  }, [activeTab, paySym, recvSym, prices]);

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

  // ============ 报价 ============
  // 两条路合并成同一个出口（quote），界面不需要知道钱从哪个合约走：
  //   vault  ：按金库 NAV 同步算，输入即出结果，费率 0.5%；
  //   pancake：要问链，350ms 防抖，并丢弃过期结果 —— 用户完全可能在
  //            报价回来之前就换成另一对币，那笔迟到的结果不能盖在新界面上。
  const priceReady = !globalPriceError && (!vaultRoute || !!stablePriceData);

  // 报价 effect 的依赖只放标量。价格轮询每 8 秒、余额轮询每 10 秒都会换掉
  // tokenBalances / stablecoinPrices 的对象引用（内容常常没变）。对象进了依赖，
  // 报价就会被反复重新计算，面板上的数字每隔几秒清空一次 —— 看起来就是
  // 「一会儿有一会儿 Quoting…」。先把要用的数字取出来，内容不变就不重算。
  const payBalNum = isConnected ? Number(tokenBalances[paySym] || 0) : 0;
  const vaultStableBalNum = vaultStable ? Number(vaultBalances[vaultStable.symbol] || 0) : 0;
  const stablePriceKey = stablePriceData && stablePriceData.price18 ? String(stablePriceData.price18) : '';
  const globalPriceErrMsg = globalPriceError ? globalPriceError.message : '';

  useEffect(() => {
    let dead = false;
    // 输入或币对一变，上一次「交易失败」的结论就失效了，不该继续把按钮锁住
    txErrorRef.current = false;

    const amt = parseFloat(inputAmount);
    if (!inputAmount || isNaN(amt) || amt <= 0 || !isFinite(amt)) {
      setQuote(EMPTY_QUOTE);
      setErrorMsg('');
      return undefined;
    }
    if (isConnected) prefetchTxLibs();

    if (paySym === recvSym) {
      setQuote(EMPTY_QUOTE);
      setErrorMsg('Pick two different tokens.');
      return undefined;
    }

    // 末尾小数点（"1."）会让解析失败；科学计数法（"1e5"）同理。
    // 抛出发生在 effect 里会把整棵 React 树卸载，这里必须兜住。
    let amountInWei;
    try {
      amountInWei = parseUnits(String(inputAmount).replace(/\.$/, ''), decIn);
    } catch (e) {
      setQuote(EMPTY_QUOTE);
      setErrorMsg('Invalid amount.');
      return undefined;
    }
    if (amountInWei <= 0n) {
      setQuote(EMPTY_QUOTE);
      setErrorMsg('');
      return undefined;
    }

    const balanceMsg = isConnected && amt > payBalNum
      ? `Insufficient ${paySym} balance`
      : '';

    // 报价的身份：币对 + 金额。同一笔在重算时不把已有数字清掉。
    const quoteKey = `${paySym}|${recvSym}|${amountInWei.toString()}`;

    if (vaultRoute) {
      const price18 = stablePriceKey ? BigInt(stablePriceKey) : null;
      if (globalPriceErrMsg) {
        setQuote(EMPTY_QUOTE);
        setErrorMsg('Network error. Please retry.');
        return undefined;
      }
      // 报价没到手时不要硬算：price18 为 null 时直接取会把 effect 抛穿
      if (!price18) {
        setQuote({ ...EMPTY_QUOTE, loading: true });
        setErrorMsg('');
        return undefined;
      }
      const deviation = price18 > 10n ** 18n ? price18 - 10n ** 18n : 10n ** 18n - price18;
      if (Number(deviation * 10000n / 10n ** 18n) > CONFIG.MAX_PRICE_DEVIATION * 10000) {
        setQuote(EMPTY_QUOTE);
        setErrorMsg(`${vaultStable.symbol} price deviation exceeds 2%. Trading paused.`);
        return undefined;
      }

      if (paySym !== 'UFO') {
        // 稳定币 → UFO：美元金额扣 0.5% 后按 1:1 铸造
        const usdValue = (amountInWei * price18) / 10n ** 18n;
        const feeUsd = (usdValue * 50n) / 10000n;
        const ufoOut = usdValue - feeUsd;
        setQuote({
          out: formatTokenAmount(formatUnits(ufoOut, 18)),
          fee: formatTokenAmount(formatUnits(feeUsd, 18)),
          amountInWei, minOutWei: ufoOut,
          path: null, kind: 'vault', hops: 1, loading: false, pairKey: quoteKey
        });
        setErrorMsg(balanceMsg);
      } else {
        // UFO → 稳定币：UFO 面值即美元，扣 0.5% 后按 NAV 折回代币
        const feeUfo = (amountInWei * 50n) / 10000n;
        const netUfo = amountInWei - feeUfo;
        const tokenOut = (netUfo * 10n ** 18n) / price18;
        // 合约实际转出 = 净额 + 以稳定币扣除的那份手续费（与 withdraw 的 totalOut 对齐）
        const feeTokens = (feeUfo * 10n ** 18n) / price18;
        const totalOut = tokenOut + feeTokens;

        const vaultBal = vaultStableBalNum;
        let msg = balanceMsg;
        if (parseFloat(formatUnits(totalOut, 18)) > vaultBal) {
          msg = `Insufficient ${vaultStable.symbol} in Vault. Available: ${vaultBal.toFixed(2)}`;
        }
        setQuote({
          out: formatTokenAmount(formatUnits(tokenOut, 18)),
          fee: formatTokenAmount(formatUnits(feeUfo, 18)),
          amountInWei, minOutWei: tokenOut,
          path: null, kind: 'vault', hops: 1, loading: false, pairKey: quoteKey
        });
        setErrorMsg(msg);
      }
      return undefined;
    }

    // ---- BNB Chain 上的 AMM 报价 ----
    // 同一笔报价重算时不清空已有数字：价格轮询会周期性触发重算，清一次闪一次。
    // 只有币对或金额变了（pairKey 不同）才切到「Quoting…」。
    setQuote((prev) => (
      prev.pairKey === quoteKey && prev.amountInWei === amountInWei && prev.out !== '0'
        ? { ...prev, loading: true }
        : { ...EMPTY_QUOTE, loading: true, amountInWei, pairKey: quoteKey }
    ));
    setErrorMsg(balanceMsg);

    const timer = setTimeout(async () => {
      try {
        // 6 秒上限：报价不是网络测速，挂太久只会让按钮一直停在 Quoting…。
        // 超时就报「读不到」，让用户自己决定要不要再点一次。
        const q = await quotePancake(payToken, receiveToken, amountInWei, 6000);
        if (dead) return;
        if (!q) {
          setQuote({ ...EMPTY_QUOTE, amountInWei, pairKey: quoteKey });
          setErrorMsg(`No swap route for ${paySym} → ${recvSym} on BNB Chain.`);
          return;
        }
        // 滑点：一端是稳定币或 BNB 时 0.5%，两个波动币之间 1%。
        // 定太紧会因为一笔大额买单把池子推过线而 revert，定太松等于不设保护。
        const volatile = !isStable(paySym) && !isStable(recvSym) &&
          paySym !== 'BNB' && recvSym !== 'BNB';
        const slipBps = volatile ? 100n : 50n;
        const minOut = (q.amountOutWei * (10000n - slipBps)) / 10000n;
        setQuote({
          out: formatTokenAmount(formatUnits(q.amountOutWei, decOut)),
          fee: '0',
          amountInWei, minOutWei: minOut,
          path: q.path, kind: 'pancake', hops: q.path.length - 1,
          loading: false, pairKey: quoteKey
        });
        setErrorMsg(balanceMsg);
      } catch (e) {
        if (dead) return;
        setQuote({ ...EMPTY_QUOTE, amountInWei, pairKey: quoteKey });
        setErrorMsg('Price feed unreachable. Please retry.');
      }
    }, 350);

    return () => { dead = true; clearTimeout(timer); };
  }, [
    inputAmount, paySym, recvSym, decIn, decOut, payToken, receiveToken,
    vaultRoute, isConnected, payBalNum, vaultStableBalNum,
    stablePriceKey, globalPriceErrMsg
  ]);

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

    // 报价可能刚好在点击的瞬间过期（比如用户改了金额还没等新的回来）。
    // 没有 amountInWei 就不发交易 —— 宁可让按钮再点一次，也不签一笔金额为 0 的。
    if (!quote.minOutWei || quote.minOutWei <= 0n) {
      setErrorMsg('Still pricing. Give it a second and try again.');
      return;
    }

    setIsProcessing(true);
    setTxMsg('');
    setErrorMsg('');

    const routeLabel = quote.kind === 'vault'
      ? (paySym === 'UFO' ? 'Burn' : 'Issuance')
      : 'Swap';

    const txRecord = {
      time: new Date().toLocaleString(),
      type: routeLabel,
      payAmount: inputAmount,
      paySymbol: paySym,
      receiveAmount: quote.out,
      receiveSymbol: recvSym,
      status: 'Pending',
      txHash: ''
    };

    try {
      // ethers 在这一刻才被下载，且只在第一次点按钮时发生
      const result = quote.kind === 'vault'
        ? await submitSwap({
            walletProvider,
            owner: address,
            tokenAddress: vaultStable.address,
            amountWei: quote.amountInWei,
            isBuy: paySym !== 'UFO',
            onStage: setTxMsg
          })
        : await submitPancakeSwap({
            walletProvider,
            owner: address,
            payToken,
            receiveToken,
            amountWei: quote.amountInWei,
            path: quote.path,
            minOutWei: quote.minOutWei,
            inDecimals: decIn,
            outDecimals: decOut,
            onStage: setTxMsg
          });

      txRecord.txHash = result.hash;
      txRecord.payAmount = result.paid;
      if (result.received) txRecord.receiveAmount = result.received;
      txRecord.status = 'Success';
      setTxMsg(quote.kind === 'vault'
        ? (paySym === 'UFO' ? 'Burn cleared.' : 'Issuance cleared.')
        : 'Swap cleared.');

      saveTxToHistory(txRecord);
      setInputAmount('');
      setQuote(EMPTY_QUOTE);
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

  // 未连接时先走创建 / 解锁；已连接才打开转账面板
  const openTransfer = (m) => {
    if (!isConnected) {
      setWalletPanel(hasWallet ? 'unlock' : 'create');
      return;
    }
    setTransferMode(m);
  };

  // 转账成功后：记一笔本地流水 + 立刻重读余额（不等 10 秒轮询）
  const handleTransferSent = (r) => {
    saveTxToHistory({
      time: new Date().toLocaleString(),
      type: 'Sent',
      payAmount: r.amount,
      paySymbol: r.symbol,
      receiveAmount: r.to.slice(0, 6) + '…' + r.to.slice(-4),
      receiveSymbol: '',
      status: 'Success',
      txHash: r.hash
    });
    fetchUserBalances();
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all local history?')) {
      localStorage.removeItem('ufo_tx_history');
      setHistory([]);
    }
  };

  const formatUsd = (val) => Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ============ 闪兑面板的派生值 ============
  // 两侧代币只有一个来源（paySym / recvSym），显示的币和提交的币不可能分叉。
  const payBal = isConnected ? Number(tokenBalances[paySym] || 0) : 0;
  const inputNum = parseFloat(inputAmount) || 0;
  const outNum = parseFloat(quote.out) || 0;
  // 两种币的美元估值都走同一张价格表，面板上的 $ 数和钱包页的总额不会打架
  const payUsd = inputNum * (priceOf(paySym) ?? 0);
  const outUsd = outNum * (priceOf(recvSym) ?? 0);

  // 钱包里这个币为 0：按钮改成充值，点了直接去钱包页的收款面板。
  // 这不是「禁用态」—— 空钱包配一个灰按钮等于让人卡在这里。
  const needTopUp = isConnected && payBal <= 0;
  // 报价还没回来、或金额为 0 时不能点：那不是「禁用态」，是「还没到能签的时候」。
  const swapDisabled = isProcessing || (isConnected && !needTopUp && (
    !!errorMsg || !inputAmount || parseFloat(inputAmount) <= 0 ||
    !priceReady || !(quote.minOutWei > 0n)
  ));

  // 代币 → 美元，全部来自链上：
  //   · UFO 取金库净值 getExchangeRate（它的赎回价就是 NAV，链上没有池子）；
  //   · 其余币种取 PancakeSwap 的 USDT 报价（见 chain.readTokenPrices）；
  //   · 稳定币硬编码 1 —— 它们本身就是计价单位；
  //   · BNB 在询价失败时退回 Chainlink 预言机。
  // 拿不到就返回 null，界面显示 "—" —— 一个钱包不能把「读不到」写成 0。
  // 用函数声明而不是 const 箭头：它被下面的 payUsd 先用、后定义，
  // const 会落在 TDZ 里直接抛 ReferenceError（整页白屏）。
  function priceOf(symbol) {
    // NAV 没读回来之前不能拿初始值 1 顶上去 —— 那会把「还没读到」显示成
    // 一个确定的 $1.00 估值，等于编了一个数
    if (symbol === 'UFO') return navStatus === 'ready' ? currentNav : null;
    if (prices[symbol] != null) return prices[symbol];
    if (isStable(symbol)) return 1;
    if (symbol === 'BNB' && bnbPrice != null) return bnbPrice;
    return null;
  }

  // 钱包资产列表：只列真的有钱的币，按美元估值从大到小。
  // 这里不按「代币表顺序」排 —— 用户关心的是哪一笔最值钱，不是我们的配置顺序。
  const portfolio = TOKENS
    .map((t) => {
      const balance = isConnected ? Number(tokenBalances[t.symbol] || 0) : 0;
      const price = priceOf(t.symbol);
      return { ...t, balance, price, usd: price == null ? null : balance * price };
    })
    .filter((t) => t.balance > 0)
    .sort((a, b) => (b.usd || 0) - (a.usd || 0));

  const totalUsd = portfolio.reduce((sum, t) => sum + (t.usd || 0), 0);

  // 弹窗要用的是「整张表 + 价格」，没有余额的币也要能显示 0.00
  const priceMap = TOKENS.reduce((m, t) => {
    const p = priceOf(t.symbol);
    if (p != null) m[t.symbol] = p;
    return m;
  }, {});

  // ---- 报价明细的两行文案 ----
  // Rate 用「1 个付款币能换多少收款币」表达，和面板上两个数字同源，
  // 不会出现「面板写 1.02、明细写 0.98」这种自相矛盾。
  const rateLine = (() => {
    if (!(inputNum > 0) || !(outNum > 0)) return '—';
    const r = outNum / inputNum;
    if (r >= 100) return `1 ${paySym} = ${r.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${recvSym}`;
    if (r >= 1) return `1 ${paySym} = ${r.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${recvSym}`;
    return `1 ${paySym} = ${formatTokenAmount(r)} ${recvSym}`;
  })();

  // 路由与费率都读 vaultRoute（币对本身决定的），不读 quote.kind ——
  // quote 可能是上一对币留下的，也可能是空对象，拿它写文案会出现
  // 「CAKE → UFO 却写着 Vault」这种自相矛盾的画面。
  const routeLine = (() => {
    if (vaultRoute) return `UFO Vault · ${paySym} → ${recvSym}`;
    if (!quote.path) return '—';
    const name = (addr) => {
      const a = String(addr).toLowerCase();
      const hit = TOKENS.find((t) => (t.address || '').toLowerCase() === a);
      return hit ? hit.symbol : a.slice(0, 6) + '…';
    };
    return 'BNB Chain · ' + quote.path.map(name).join(' → ');
  })();

  const feeLine = (() => {
    if (!(outNum > 0)) return '—';
    if (vaultRoute) return `-${quote.fee} USD`;
    return `0.25% × ${quote.hops} hop${quote.hops > 1 ? 's' : ''}`;
  })();

  const openAccounts = () => setWalletPanel('accounts');

  // 点哪一侧的胶囊，弹窗就替哪一侧选币。
  // 选到另一侧已经占着的币，直接对调两侧 —— 用户的意图显然是「换过来」，
  // 而不是把两边都选成同一个币（那样永远换不成）。
  const pickToken = (side, coin) => {
    if (!coin || !TOKEN_BY_SYMBOL[coin.symbol]) return;
    const next = coin.symbol;
    if (side === 'pay') {
      if (next === recvSym) { setPaySym(recvSym); setRecvSym(paySym); }
      else setPaySym(next);
    } else {
      if (next === paySym) { setRecvSym(paySym); setPaySym(recvSym); }
      else setRecvSym(next);
    }
    setPickerSide('');
    setInputAmount('');
    setQuote(EMPTY_QUOTE);
    setErrorMsg('');
    setTxMsg('');
  };

  const setMax = () => {
    if (payBal <= 0) return;
    const v = Math.floor(payBal * 1e6) / 1e6;
    setInputAmount(v ? String(v) : '');
  };

  const flipDirection = () => {
    setPaySym(recvSym);
    setRecvSym(paySym);
    setInputAmount('');
    setQuote(EMPTY_QUOTE);
    setTxMsg('');
    setErrorMsg('');
    setPickerSide('');
  };

  // 一颗按钮担三种意思，顺序不能换：
  // 没解锁先解锁 → 这个币没钱就充值 → 有钱才真的下单。
  const onSwapCta = () => {
    if (isProcessing) return;
    if (!isConnected) { setWalletPanel(hasWallet ? 'unlock' : 'create'); return; }
    if (needTopUp) { setActiveTab('assets'); setTransferMode('receive'); return; }
    handleAction();
  };

  const ctaLabel = isProcessing ? 'Processing…'
    : !isConnected ? (hasWallet ? 'Unlock Wallet' : 'Create Wallet')
      : needTopUp ? 'Top Up'
        : 'Swap';

  // 底部五个入口，顺序就是产品的主线：先看钱（Wallet）→ 看规则（Readme）
  // → 干活（Trade）→ 查账（History）→ 找人（Contact）。
  const TABS = [
    {
      id: 'assets', label: 'Wallet',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
    },
    {
      id: 'readme', label: 'Readme',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H2z" /><path d="M22 4.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H22z" /><path d="M12 9.5v8" /></svg>
    },
    {
      id: 'trade', label: 'Trade',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20V5" /><path d="M3.5 8.5L7 5l3.5 3.5" /><path d="M17 4v15" /><path d="M20.5 15.5L17 19l-3.5-3.5" /></svg>
    },
    {
      id: 'history', label: 'History',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3.2 1.9" /></svg>
    },
    {
      id: 'contact', label: 'Contact',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
    }
  ];

  return (
    <div style={{ ...FONT_STYLE, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative', backgroundColor: '#f8fafc', color: '#1e293b' }}>

      {/* 装饰光斑：纯视觉，必须让点击穿透，否则会盖在内容上吞掉点击 */}
      <div style={{ position: 'absolute', top: '-50px', left: '-50px', width: '250px', height: '250px', background: '#bfdbfe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0, pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', bottom: '50px', right: '-50px', width: '250px', height: '250px', background: '#ddd6fe', borderRadius: '50%', filter: 'blur(80px)', opacity: 0.4, zIndex: 0, pointerEvents: 'none' }}></div>

      {/* Header */}
      {/* zIndex 必须高于主内容(10)和底栏(20)：header 和主内容是兄弟节点，
          同级时后渲染的会盖住前面的，账户菜单就会被 Swap 卡片压住 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px clamp(10px, 3.4vw, 20px)', gap: '6px',
                    zIndex: 30, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <div style={{ width: 'clamp(28px, 7.8vw, 32px)', height: 'clamp(28px, 7.8vw, 32px)', flexShrink: 0,
                        background: '#fff', borderRadius: '50%', display: 'flex', justifyContent: 'center',
                        alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <UfoIcon size={22} />
          </div>
          {/* 品牌名是 UFO Wallet；链上的贸易币全名仍是 UFO Dollar（见 UFO_TOKEN.name） */}
          <span style={{ fontSize: 'clamp(13.5px, 3.9vw, 16px)', fontWeight: '700', letterSpacing: '-0.4px',
                         whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            UFO<span style={{ color: '#3b82f6' }}> Wallet</span>
          </span>
        </div>
        {/* 右上角：Lock → Account N。
            「Account 3」既是身份（是第几个账户，地址不显示）也是账户管理入口，
            点它直接进账户面板；Lock 只做一件事：把私钥从内存里清掉。 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isConnected ? (
            <button
              onClick={lockWallet}
              aria-label="Lock wallet"
              title="Lock wallet"
              style={SKY_BTN}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="10.5" width="16" height="10.5" rx="2.2" />
                <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
              </svg>
              Lock
            </button>
          ) : (
            <button
              onClick={() => setWalletPanel(hasWallet ? 'unlock' : 'create')}
              disabled={walletBusy}
              style={{ ...SKY_BTN, opacity: walletBusy ? 0.7 : 1, cursor: walletBusy ? 'wait' : 'pointer' }}
            >
              {walletBusy ? 'Working…' : hasWallet ? 'Unlock' : 'Create Wallet'}
            </button>
          )}

          {/* 账户入口在锁定时也在：点它先进 PIN，再看得到地址与私钥。
              否则「锁上之后想切账户」就只剩重新解锁一条路。 */}
          {hasWallet && accounts.length > 0 && (
            <button
              onClick={() => setWalletPanel('accounts')}
              aria-label={`Account ${accountNo ?? ''} — manage accounts`}
              title="Accounts"
              style={SKY_BTN}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', display: 'inline-block', flexShrink: 0 }} />
              Account {accountNo ?? '—'}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch', overflowY: 'auto', padding: '0 20px 104px 20px', zIndex: 10 }}>

        {/* ================= 闪兑 ================= */}
        {/* 版式与截图一致：两张灰卡、居中大数字、中间翻转钮、一颗天蓝主按钮。
            差别只在文案（Instant Swap / Swap）和下方不抢留白的价格明细。 */}
        {activeTab === 'trade' && (
          <div style={{ marginTop: '2px' }}>

            <div style={{ ...UI_FONT, textAlign: 'center', fontSize: '21px', fontWeight: 800,
                          letterSpacing: '-0.5px', color: SWAP_TINT.ink, marginBottom: '16px' }}>
              Instant Swap
            </div>

            {(stablePriceError || globalPriceError) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            fontSize: '11px', marginBottom: '12px', fontWeight: 600, color: '#ef4444' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                {(stablePriceError || globalPriceError).message}
              </div>
            )}

            {/* ---- 付款 ---- */}
            <div style={{ background: SWAP_TINT.card, borderRadius: '22px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <TokenChip
                  token={payToken}
                  onClick={() => setPickerSide('pay')}
                />

                <button
                  type="button"
                  onClick={setMax}
                  disabled={payBal <= 0}
                  title="Use the whole balance"
                  style={{ ...skyBtn('xs', { soft: true, disabled: payBal <= 0 }),
                           fontVariantNumeric: 'tabular-nums' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 8H5a2 2 0 0 0 0 4h11a2 2 0 0 1 0 4H4" /><path d="M17 5l3 3-3 3" />
                  </svg>
                  {payBal.toFixed(2)} Max
                </button>
              </div>

              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
                aria-label={`Amount of ${payToken.symbol}`}
                style={{ ...UI_FONT, width: '100%', border: 'none', outline: 'none', background: 'transparent',
                         textAlign: 'center', fontSize: '46px', fontWeight: 700, color: SWAP_TINT.ink,
                         letterSpacing: '-1.5px', padding: '16px 0 4px', lineHeight: 1.1 }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            fontSize: '12.5px', fontWeight: 600, color: SWAP_TINT.mute }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4v13" /><path d="M4 14l3 3 3-3" /><path d="M17 20V7" /><path d="M14 10l3-3 3 3" />
                </svg>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {priceOf(paySym) == null ? '≈ —' : '$' + formatUsd(payUsd)}
                </span>
              </div>
            </div>

            {/* ---- 翻转 ---- */}
            <div style={{ position: 'relative', height: '28px', zIndex: 6 }}>
              <button
                onClick={flipDirection}
                disabled={isProcessing}
                aria-label="Switch direction"
                title="Switch direction"
                style={{ position: 'absolute', left: '50%', top: '-8px', transform: 'translateX(-50%)',
                         width: '44px', height: '44px', borderRadius: '50%',
                         border: 'none', background: 'linear-gradient(180deg, #5CCBEC 0%, #38BDF8 100%)',
                         color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                         cursor: isProcessing ? 'not-allowed' : 'pointer',
                         opacity: isProcessing ? 0.5 : 1,
                         boxShadow: '0 0 0 6px #f4f5f7, 0 6px 16px -2px rgba(56,189,248,0.8)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 4v13" /><path d="M4 14l3 3 3-3" />
                  <path d="M17 20V7" /><path d="M14 10l3-3 3 3" />
                </svg>
              </button>
            </div>

            {/* ---- 收款 ---- */}
            <div style={{ background: SWAP_TINT.card, borderRadius: '22px', padding: '20px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <TokenChip
                  token={receiveToken}
                  onClick={() => setPickerSide('receive')}
                />

                <div style={{ textAlign: 'right', minWidth: 0 }}>
                  <div style={{ ...UI_FONT, fontSize: '17px', fontWeight: 700, lineHeight: 1.25,
                                color: outNum > 0 ? SWAP_TINT.ink : SWAP_TINT.mute,
                                fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>
                    {outNum > 0 ? quote.out : (quote.loading && inputNum > 0 ? 'Quoting…' : '—')}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: SWAP_TINT.mute, marginTop: '3px' }}>
                    {outNum > 0
                      ? (priceOf(recvSym) == null ? '≈ —' : '≈ $' + formatUsd(outUsd))
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div style={{ marginTop: '12px', color: '#ef4444', fontSize: '12px', fontWeight: 600,
                            textAlign: 'center', lineHeight: 1.55 }}>
                {errorMsg}
              </div>
            )}

            {txMsg && (
              <div style={{ marginTop: '12px', padding: '10px', textAlign: 'center',
                            background: txMsg.includes('cleared') ? '#ecfdf5' : '#eff6ff',
                            color: txMsg.includes('cleared') ? '#10b981' : '#3b82f6',
                            borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}>
                {txMsg}
              </div>
            )}

            <button
              onClick={onSwapCta}
              disabled={swapDisabled}
              style={{ ...UI_FONT, ...skyBtn('lg', { block: true, disabled: swapDisabled }),
                       marginTop: '18px', borderRadius: '28px', fontSize: '17px',
                       letterSpacing: '0.2px' }}
            >
              {ctaLabel}
            </button>

            {/* 明细放在按钮下方：面板本身保持截图里的留白。
                两条路显示的东西不同 —— 金库是手收费，Pancake 是池子费 + 滑点 ——
                但版式统一成「左边名目、右边值」。 */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
                          fontSize: '12px', fontWeight: 600, color: SWAP_TINT.mute }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span>Rate</span>
                <span style={{ color: '#667085', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                  {rateLine}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span>Route</span>
                <span style={{ color: '#667085', fontVariantNumeric: 'tabular-nums', textAlign: 'right',
                               wordBreak: 'break-word' }}>
                  {routeLine}
                </span>
              </div>
              {quote.kind === 'pancake' && outNum > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span>Minimum received</span>
                  <span style={{ color: '#667085', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
                    {formatTokenAmount(formatUnits(quote.minOutWei, decOut))} {recvSym}
                  </span>
                </div>
              )}
              {(paySym === 'UFO' || recvSym === 'UFO') && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span>UFO price (on-chain)</span>
                  <span style={{ color: '#667085', fontVariantNumeric: 'tabular-nums' }}>
                    1 UFO = ${currentNav.toFixed(4)}{navStatus === 'error' ? ' (read failed)' : ''}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span>{vaultRoute ? 'Fee (0.5%)' : 'Pool fee'}</span>
                <span style={{ color: vaultRoute && outNum > 0 ? '#ef4444' : SWAP_TINT.mute,
                               fontVariantNumeric: 'tabular-nums' }}>
                  {feeLine}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{ marginTop: '2px' }}>
          {/* 总额：钱包页第一眼要看到「我这儿有多少钱」。
              绿色是这套产品里表示「资产在账上」的颜色，与收发按钮区分开。 */}
          <div style={{ padding: '12px 4px 18px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#94a3b8',
                          letterSpacing: '0.9px', textTransform: 'uppercase' }}>
              Total balance
            </div>
            <div style={{ marginTop: '4px', fontSize: '40px', fontWeight: 800, color: '#10b981',
                          letterSpacing: '-1.6px', lineHeight: 1.12, fontVariantNumeric: 'tabular-nums',
                          wordBreak: 'break-all' }}>
              $ {formatUsd(totalUsd)}
            </div>
          </div>

          <div style={{ ...SUB_CARD }}>
            {/* 资产列表上方的两个动作。未连接时点了先走创建/解锁，
                不在这里另做一套「请先连接钱包」的提示。 */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <button
                type="button"
                onClick={() => openTransfer('send')}
                style={{ ...skyBtn('md', { block: true }), flex: 1, height: '46px', fontSize: '14px' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
                </svg>
                Send
              </button>
              <button
                type="button"
                onClick={() => openTransfer('receive')}
                style={{ ...skyBtn('md', { block: true, soft: true }), flex: 1, height: '46px', fontSize: '14px' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14" /><path d="M19 12l-7 7-7-7" />
                </svg>
                Receive
              </button>
            </div>

            {/* 资产列表：只列真的有钱的币。代币表里的十几个币全部参与读取，
                但余额为 0 的不占版面 —— 一个空钱包不该显示 15 行 0.00。 */}
            {portfolio.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '26px 10px 10px', color: '#94a3b8' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>No assets yet</div>
                <div style={{ fontSize: '12px', marginTop: '6px', lineHeight: 1.7 }}>
                  Receive BNB or any BEP-20 token to this account and it shows up here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {portfolio.map((t, i) => (
                  <div key={t.symbol} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    paddingBottom: '16px', marginBottom: i === portfolio.length - 1 ? 0 : '16px',
                    borderBottom: i === portfolio.length - 1 ? 'none' : '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <TokenIcon token={t} size={40} />
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 700 }}>{t.symbol}</span>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b',
                                         fontVariantNumeric: 'tabular-nums' }}>
                            {t.price == null
                              ? '—'
                              : '$' + t.price.toLocaleString('en-US', {
                                  minimumFractionDigits: t.price >= 100 ? 2 : 4,
                                  maximumFractionDigits: t.price >= 100 ? 2 : 4
                                })}
                            {t.symbol === 'UFO' && navStatus === 'error' ? ' *' : ''}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap',
                                       overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.name}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontSize: '17px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {formatAmount(t.balance, 6)}
                      </span>
                      <span style={{ fontSize: '12.5px', color: '#10b981', fontWeight: 600,
                                     marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                        {t.usd == null
                          ? '≈ —'
                          : '≈ $' + t.usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  style={skyLink('sm')}
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
                  <button type="button" onClick={clearHistory} style={skyBtn('xs', { soft: true })}>
                    Clear All
                  </button>
                )}
              </div>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 12px auto' }}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p style={{ fontSize: '14px' }}>Nothing yet. Every swap you make will be written here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {history.map((tx, idx) => (
                  <div key={idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: (tx.type === 'Issuance' || tx.type === 'Swap') ? '#3b82f6' : (tx.type === 'Sent' ? '#0f766e' : '#8b5cf6') }}>{tx.type}</span>
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
                      <div>
                        {tx.type === 'Sent' ? 'Sent' : 'Paid'}: <span style={{ fontWeight: '600', color: '#1e293b' }}>{tx.payAmount} {tx.paySymbol}</span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {tx.type === 'Sent'
                          ? <>To: <span style={{ fontWeight: '600', color: '#1e293b', fontFamily: 'monospace' }}>{tx.receiveAmount}</span></>
                          : <>Received: <span style={{ fontWeight: '600', color: '#1e293b' }}>{tx.receiveAmount} {tx.receiveSymbol}</span></>}
                      </div>
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

        {/* Guide 与 Rules 合并为一页，页内切换 */}
        {activeTab === 'readme' && <ReadmeTab />}

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

      {/* Bottom Nav：悬浮胶囊，与截图同款。
           absolute 而非 fixed —— 相对 #root 停靠，桌面宽屏下不会横跨整个视口。 */}
      <div style={{
        position: 'absolute', bottom: '10px', left: '12px', right: '12px',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        background: 'linear-gradient(180deg, #ffffff 0%, #edf0f4 100%)',
        border: '1px solid rgba(255,255,255,0.9)',
        borderRadius: '26px', padding: '7px 2px',
        boxShadow: '0 14px 34px -14px rgba(15,23,42,0.3), 0 2px 6px rgba(15,23,42,0.04)',
        zIndex: 20
      }}>
        {TABS.map((tab) => {
          const on = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              role="button"
              tabIndex={0}
              aria-label={tab.label}
              aria-current={on ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab(tab.id); }}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                       justifyContent: 'center', gap: '3px', cursor: 'pointer', padding: '2px 0',
                       WebkitTapHighlightColor: 'transparent' }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: on ? '#111827' : 'transparent',
                color: on ? '#ffffff' : '#a4adb8',
                transition: 'background 0.18s ease, color 0.18s ease'
              }}>
                {tab.icon}
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: on ? 800 : 600,
                             color: on ? '#111827' : '#a4adb8', letterSpacing: '-0.1px' }}>
                {tab.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 代币弹窗：闪兑面板的两枚胶囊共用它，点哪侧就替哪侧选币 */}
      <TokenPicker
        open={!!pickerSide}
        tokens={TOKENS}
        balances={tokenBalances}
        prices={priceMap}
        selectedSymbol={(pickerSide === 'receive' ? receiveToken : payToken).symbol}
        otherSymbol={(pickerSide === 'receive' ? payToken : receiveToken).symbol}
        onSelect={(coin) => pickToken(pickerSide, coin)}
        onClose={() => setPickerSide('')}
      />

      <TransferSheet
        mode={transferMode}
        onClose={() => setTransferMode('')}
        address={address}
        accountNo={accountNo}
        balances={tokenBalances}
        tokens={portfolio}
        provider={walletProvider}
        onSent={handleTransferSent}
      />

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
            style={{ ...skyBtn('md', { soft: true }), marginTop: '4px' }}
          >
            Retry
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ ...skyBtn('md'), marginTop: '4px' }}
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
