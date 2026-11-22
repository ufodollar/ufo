import { useState, useEffect, useCallback, useRef } from 'react';
import { watchInjectedWallets, isMobile, AUTOCONNECT_PARAM } from './wallets';
import { hasOkxPending, clearOkxPending, hasStoredOkxSession } from './okxpending';

// 本会话主动断开后，不要再用注入式自动连回去
const OPTOUT_KEY = 'ufo_inj_off';

// 这个浏览器里成功连接过一次。
// 只写在钱包内置浏览器自己的 WebView 存储里，与手机上的 Chrome 互不相通，
// 所以它只表达一件事：「这个人上次在这里连过」—— 再进来时直接续上。
const SEEN_KEY = 'ufo_linked';

// OKX Connect 完成连接后回跳的标记。与 c=1 分开，是因为两者要做的事不同：
//   c=1  → 页面里有 window.ethereum，走注入式授权
//   okx=1 → 页面里没有注入，会话在 OKX SDK 里，需要单独恢复
const OKX_RETURN_PARAM = 'okx';

// 地址统一小写。
// 不用 ethers 的 getAddress：它会对混合大小写做 EIP-55 校验和验证，
// 钱包返回不规范的地址时会抛错，导致「有地址却显示未连接」。
function normalizeAddress(addr) {
  return String(addr || '').toLowerCase();
}

// BNB Smart Chain
const BSC_CHAIN_ID = '0x38';

/**
 * 连上之后立刻把钱包拨到 BSC，全程不弹我们自己的任何 UI。
 *
 * 为什么放在「连上之后」而不是页面加载时：授权之前钱包不会响应
 * wallet_switchEthereumChain，太早调用只会拿到 4100（unauthorized）。
 *
 * 这是网页能做的极限。钱包自己那一层「选择网络」弹窗属于 App 的
 * dapp 浏览器，在页面加载前就已发生，任何 JS 都够不着 —— 那一层只能靠
 * deeplink 参数（Bitget 的 _needChain、Trust 的 coin_id、Coin98 的 chainId）。
 *
 * 失败一律吞掉：链不对只影响写交易，读数据走的是固定 RPC，
 * 页面照常显示余额，不该因为切链失败就报错给用户。
 */
async function ensureBscChain(provider) {
  if (!provider || typeof provider.request !== 'function') return;
  try {
    const current = await provider.request({ method: 'eth_chainId' });
    if (!current || String(current).toLowerCase() === BSC_CHAIN_ID) return;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_CHAIN_ID }]
      });
    } catch (err) {
      // 4902 = 钱包里还没有这条链。补一次 addEthereumChain，添加后多数钱包会自己切过去。
      if (!err || (err.code !== 4902 && err.code !== -32603)) return;
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BSC_CHAIN_ID,
          chainName: 'BNB Smart Chain',
          nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
          rpcUrls: ['https://bsc-dataseed.binance.org/'],
          blockExplorerUrls: ['https://bscscan.com/']
        }]
      });
    }
  } catch (e) { /* 用户拒绝 / 钱包不支持，保持原状 */ }
}

function readFlag(storage, key) {
  try { return storage.getItem(key) === '1'; } catch (e) { return false; }
}

/**
 * 钱包把 provider 注入到 window 的时机可能晚于首帧，尤其 iOS 上的 WebView。
 * 抢跑的结果是「页面显示未连接、用户手动点一下才好」，等一等反而更可靠。
 */
function waitForProvider(timeout) {
  return new Promise((resolve) => {
    const started = Date.now();
    (function tick() {
      if (typeof window !== 'undefined' && window.ethereum) return resolve(window.ethereum);
      if (Date.now() - started >= timeout) {
        return resolve((typeof window !== 'undefined' && window.ethereum) || null);
      }
      setTimeout(tick, 80);
    })();
  });
}

/** 用过就把 c=1 / okx=1 从地址栏去掉，避免用户手动刷新时又弹一次授权框 */
function clearAutoconnectParam() {
  try {
    const url = new URL(location.href);
    let touched = false;
    if (url.searchParams.has(AUTOCONNECT_PARAM)) { url.searchParams.delete(AUTOCONNECT_PARAM); touched = true; }
    if (url.searchParams.has(OKX_RETURN_PARAM)) { url.searchParams.delete(OKX_RETURN_PARAM); touched = true; }
    if (!touched) return;
    history.replaceState(null, '', url.pathname + (url.search || ''));
  } catch (e) { /* 地址异常时留着参数也无害 */ }
}

/**
 * 钱包状态。
 *
 * 只有一条连接路径：EIP-1193。
 *   - 钱包 App 内置浏览器 / 装了扩展的桌面浏览器：window.ethereum 已经在那儿，
 *     打开页面即静默恢复，零网络开销、零下载。
 *   - 多个扩展并存时用 EIP-6963 精确选出用户点的那一个。
 *   - 手机普通浏览器：没有注入，交给 WalletPicker 跳 App 内置浏览器，
 *     落地后仍然是这条路径 —— 所以永远不需要 WalletConnect 中转。
 *
 * 对上层暴露的仍然是老三样：address / provider / isConnected。
 */
export function useWallet() {
  const [account, setAccount] = useState(null);       // { address, provider }
  const [injectedWallets, setInjectedWallets] = useState([]); // EIP-6963 发现的扩展
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);
  const [error, setError] = useState('');

  const optedOut = useRef(false);
  // 给下面的 watchdog 用的「当前是否已连上」。用 ref 而不是依赖 account，
  // 是为了让监听器绑一次就够，不会随每次状态变化重新注册。
  const accountRef = useRef(null);
  useEffect(() => { accountRef.current = account; }, [account]);

  // 发现浏览器里所有实现了 EIP-6963 的钱包
  useEffect(() => watchInjectedWallets(setInjectedWallets), []);

  const accept = useCallback((accounts, provider) => {
    if (!accounts || !accounts.length) return false;
    optedOut.current = false;
    try { sessionStorage.removeItem(OPTOUT_KEY); } catch (e) { /* 无痕模式 */ }
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 无痕模式 */ }
    setAccount({ address: normalizeAddress(accounts[0]), provider });
    setError('');
    // 不等它：切链是后台动作，用户点完图标应当立刻看到页面。
    // 已经在 BSC 时会先读一次 chainId 就返回，代价是一次本地调用。
    ensureBscChain(provider);
    return true;
  }, []);

  // ---- 落地连接 ----
  // 三档策略，从「完全静默」到「主动弹授权」：
  //   1. 已授权 → eth_accounts 直接返回地址，用户看不到任何弹窗（Trust Wallet 走这里）
  //   2. 从钱包图标跳进来，或这个浏览器里连过 → 立刻 eth_requestAccounts，
  //      MetaMask 弹出它自己的授权框，用户点一次「连接」即完成
  //   3. 其他情况（普通浏览器打开本站）→ 什么都不做，等用户点按钮
  //
  // 第 2 档是「秒连」能做到的极限。首次授权必须由用户在钱包自己的界面上
  // 点一次确认 —— 那是钱包的安全模型，任何网页技巧都绕不过去。
  useEffect(() => {
    if (typeof window === 'undefined') return;

    optedOut.current = readFlag(sessionStorage, OPTOUT_KEY);
    if (optedOut.current) return;

    let fromWallet = false;
    let okxReturn = false;
    try {
      const params = new URL(location.href).searchParams;
      fromWallet = params.get(AUTOCONNECT_PARAM) === '1';
      okxReturn = params.get(OKX_RETURN_PARAM) === '1';
    } catch (e) { /* 地址异常，按普通访问处理 */ }

    // 地址栏里没有标记也要恢复，两种很常见的情形：
    //   1. 钱包 App 回跳时把 query 拼掉了，只回到站点根地址；
    //   2. Chrome 发现这个 URL 已经开着，直接切回原标签 —— 地址栏根本不变。
    // 这两种情况下，okxpending.js 里的本地标记是唯一的线索。
    if (hasOkxPending()) okxReturn = true;

    // 连过一次之后，这个浏览器里就存着一条 OKX 会话：以后每次打开页面都该是
    // 已连接状态，而不是让用户再点一次。判断只看 localStorage 的键名，
    // 不下载 SDK —— 没连过的人一分钱都不用付。
    const okxStored = okxReturn || hasStoredOkxSession();

    // 参数一旦读进变量就没有用了，立刻从地址栏抹掉。
    // 放在这里而不是各个分支结尾：无论后面走静默恢复、主动授权还是无声退出，
    // 用户复制网址、刷新页面时都不会再看到它，也不会因此重复弹授权框。
    if (fromWallet || okxReturn) clearAutoconnectParam();

    const seenBefore = readFlag(localStorage, SEEN_KEY);
    let cancelled = false;

    // 移动端 + 有注入 = 一定在某个钱包的内置浏览器里（手机普通浏览器没有 provider）。
    // 有了这个判据，就算 deeplink 带不进 ?c=1（Coin98 就带不进，它不解码），
    // 进来后依然能自动走一次授权，不用用户自己去页面上找按钮。
    // 桌面扩展不在此列 —— 那种情况自动弹框会打扰人。
    const inWalletBrowser = isMobile();

    (async () => {
      // OKX Connect 回跳：这个页面的浏览器里没有 window.ethereum，
      // 会话保存在 OKX SDK 自己的存储里，要单独去问它一句。
      // 动态 import 保证那块 SDK 只在真的需要时才下载。
      if (okxStored) {
        // 刚从 App 回来才提示进度；普通刷新时安静恢复，别让用户看到一闪而过的状态。
        if (okxReturn && !cancelled) setAutoConnecting(true);
        try {
          const { restoreOkx } = await import('./okxconnect');
          const restored = await restoreOkx({ windowMs: okxReturn ? 10000 : 3000 });
          if (!cancelled && restored) {
            clearOkxPending();
            accept(restored.accounts, restored.provider);
            return;
          }
        } catch (e) { /* 恢复失败就当普通访问，页面上的 Connect 按钮仍然在 */ }
        finally {
          if (!cancelled) setAutoConnecting(false);
        }
        // 窗口期内没等到会话就作废标记，否则以后每次打开页面都会白跑一次恢复。
        if (!cancelled) clearOkxPending();
      }

      const eth = await waitForProvider(fromWallet || inWalletBrowser ? 3000 : 1200);
      if (cancelled || !eth) return;

      // 1) 已授权：静默恢复，不弹任何东西
      try {
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (cancelled) return;
        if (accounts && accounts.length) { accept(accounts, eth); return; }
      } catch (e) { /* 未授权，继续往下判断 */ }

      if (cancelled || (!fromWallet && !seenBefore && !inWalletBrowser)) return;

      // 2) 主动请求授权。部分钱包要求这一步由用户手势触发，
      //    被拒绝就安静收场 —— 页面上那个 Connect 按钮仍然在。
      setAutoConnecting(true);
      try {
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        if (!cancelled) accept(accounts, eth);
      } catch (e) {
        // 4001 = 用户点了取消。不报错、不重复请求。
      } finally {
        if (!cancelled) setAutoConnecting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [accept]);

  // ---- 空闲预热 OKX SDK ----
  // 「点图标之后 3 秒才切进 App」里，大头是在移动网络上下 600KB 的 SDK。
  // 页面渲染完之后趁空闲把它拿下来，用户点 OKX 时只剩一次 WS 握手。
  // 只在手机上做：桌面浏览器连不上 OKX App，预热没有意义。
  useEffect(() => {
    if (typeof window === 'undefined' || !isMobile()) return;
    // 开了省流模式的用户不要替他花这 200KB
    const conn = navigator.connection;
    if (conn && conn.saveData) return;
    let idleId = null;
    let timer = null;
    const start = () => {
      import('./okxconnect').then((m) => m.prefetchOkx()).catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(start, { timeout: 3000 });
    } else {
      timer = setTimeout(start, 1500);
    }
    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ---- 回到前台时的兜底 ----
  // 如果 Chrome 直接切回了原来的标签（URL 一致，不会触发任何导航），
  // 页面里的那笔 connect() 有时会因为后台期间 WS 被系统断掉而永远不 resolve。
  // 用户已经确认过了，不能让他对着「未连接」发呆 —— 回到前台时再恢复一次。
  useEffect(() => {
    if (typeof document === 'undefined') return;

    let running = false;
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      if (running || accountRef.current) return;
      if (!hasOkxPending()) return;

      running = true;
      setAutoConnecting(true);
      try {
        const { restoreOkx } = await import('./okxconnect');
        const restored = await restoreOkx({ windowMs: 8000 });
        if (restored) {
          clearOkxPending();
          accept(restored.accounts, restored.provider);
          return;
        }
        clearOkxPending();
      } catch (e) {
        clearOkxPending();
      } finally {
        running = false;
        setAutoConnecting(false);
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [accept]);

  // ---- 跟随当前 provider 的账户变化 ----
  // 依赖用 provider 引用而不是整个 account 对象，避免每次地址变化都重绑。
  const activeProvider = account && account.provider;
  useEffect(() => {
    if (!activeProvider || typeof activeProvider.on !== 'function') return;

    const onAccounts = (accounts) => {
      if (optedOut.current) return;
      if (accounts && accounts.length) {
        setAccount({ address: normalizeAddress(accounts[0]), provider: activeProvider });
      } else {
        setAccount(null);
      }
    };

    try { activeProvider.on('accountsChanged', onAccounts); } catch (e) { /* 个别钱包不支持事件 */ }
    return () => {
      try { activeProvider.removeListener('accountsChanged', onAccounts); } catch (e) { /* noop */ }
    };
  }, [activeProvider]);

  // 主入口：有注入就直接连；多个扩展或没有注入才弹选择器
  const connect = useCallback(async () => {
    if (busy || autoConnecting) return;
    setError('');

    const eth = typeof window !== 'undefined' ? window.ethereum : null;

    // 装了不止一个扩展时，window.ethereum 只是「最后注入的那个」，
    // 直接连等于替用户做了选择 —— 这种情况必须让他自己挑。
    if (injectedWallets.length > 1) { setPickerOpen(true); return; }

    const provider = injectedWallets.length === 1 ? injectedWallets[0].provider : eth;
    if (!provider) { setPickerOpen(true); return; }

    setBusy(true);
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      accept(accounts, provider);
    } catch (e) {
      // 4001 = 用户主动取消。安静退出，不要再弹选择器打扰他。
      if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) return;
      setError((e && (e.message || e.reason)) || 'Could not connect to the wallet.');
      setPickerOpen(true);
    } finally {
      setBusy(false);
    }
  }, [busy, autoConnecting, accept, injectedWallets]);

  // 用户在 EIP-6963 列表里点了一个扩展
  const connectWith = useCallback(async (provider) => {
    if (!provider || busy) return;
    setBusy(true);
    setError('');
    try {
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (accept(accounts, provider)) setPickerOpen(false);
    } catch (e) {
      if (e && e.code !== 4001) setError((e && (e.message || e.reason)) || 'Connection rejected.');
    } finally {
      setBusy(false);
    }
  }, [busy, accept]);

  /**
   * 钱包墙上点 OKX：走官方 Connect 协议。
   *
   * 和 connectWith 的区别只有 provider 的来源：那边是浏览器注入的
   * window.ethereum，这边是 OKX SDK 建立会话后给出的 EIP-1193 包装。
   * 拿到之后完全同构 —— accept() 之后的逻辑一行都不用改。
   *
   * 这个 Promise 会一直挂到用户在 App 里点完「连接」为止，期间页面在后台。
   */
  const connectOkxWallet = useCallback(async () => {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      // 动态 import：SDK 约 100KB（gzip 后），只有真的点 OKX 才下载
      const { connectOkx } = await import('./okxconnect');
      const { accounts, provider } = await connectOkx();
      if (accept(accounts, provider)) { setPickerOpen(false); return true; }
      return false;
    } catch (e) {
      // 4001 / reject 是用户自己取消，不当作错误上报
      if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) return false;
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy, accept]);

  const disconnect = useCallback(async () => {
    optedOut.current = true;
    try { sessionStorage.setItem(OPTOUT_KEY, '1'); } catch (e) { /* noop */ }
    // 主动断开就把「来过」的记忆一起清掉，否则刷新一下又会被自动连回去
    try { localStorage.removeItem(SEEN_KEY); } catch (e) { /* noop */ }

    // 有 revokePermissions 的钱包（MetaMask 等）会真的撤销授权，
    // 下次打开页面就不会再自动连回来。不支持的忽略即可。
    const provider = account && account.provider;
    if (provider && typeof provider.request === 'function') {
      try { await provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); }
      catch (e) { /* 不支持就算了 */ }
    }

    setAccount(null);
    setPickerOpen(false);
  }, [account]);

  // 打开钱包墙就顺手开始下 SDK：从面板出现到用户点中某个图标，
  // 通常有 1~2 秒，这段空档正好用来下载。失败无所谓，点 OKX 时还会再 import 一次。
  const openPicker = useCallback(() => {
    import('./okxconnect').then((m) => m.prefetchOkx()).catch(() => {});
    setPickerOpen(true);
  }, []);

  return {
    address: account ? account.address : null,
    provider: account ? account.provider : null,
    isConnected: !!account,
    source: account ? 'injected' : null,
    injectedWallets,
    pickerOpen,
    openPicker,
    closePicker: () => setPickerOpen(false),
    busy,
    autoConnecting,
    error,
    connect,
    connectWith,
    connectOkxWallet,
    disconnect,
    clearError: () => setError('')
  };
}
