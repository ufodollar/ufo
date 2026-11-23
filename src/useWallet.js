import { useState, useEffect, useCallback, useRef } from 'react';
import { watchInjectedWallets, isMobile, AUTOCONNECT_PARAM } from './wallets';
import { hasOkxPending, clearOkxPending, hasStoredOkxSession } from './okxpending';
import { hasWcPending, clearWcPending, hasStoredWcSession } from './wcpending';
import { hasMmPending, clearMmPending, hasMmSeen } from './mmpending';
import { WC_PROJECT_ID } from './config';

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

// WalletConnect 回跳标记。和 okx 分开，理由同 okxpending.js 的注释：
// 两条通道恢复方式不同，混在一起会互相触发对方的恢复流程。
const WC_RETURN_PARAM = 'wc';

// MetaMask Connect 回跳标记。同上：会话存在 MetaMask SDK 自己的存储里，
// 与 okx / wc 都不是一回事，必须各有各的入口。
const MM_RETURN_PARAM = 'mm';

// 地址统一小写。
// 不用 ethers 的 getAddress：它会对混合大小写做 EIP-55 校验和验证，
// 钱包返回不规范的地址时会抛错，导致「有地址却显示未连接」。
function normalizeAddress(addr) {
  return String(addr || '').toLowerCase();
}

// BNB Smart Chain
const BSC_CHAIN_ID = '0x38';

// 链状态的三档结果。不再用 true/false，是因为「切不过去」有两种完全不同的原因，
// UI 该说的话也不一样：
//   ok      → 已经在 BSC，什么都不用说
//   wrong   → 明确读到别的 chainId，且切链/加链都没成
//   unknown → 连 chainId 都读不到（个别钱包不实现 eth_chainId），不敢下结论
const CHAIN_OK = 'ok';
const CHAIN_WRONG = 'wrong';
const CHAIN_UNKNOWN = 'unknown';

/**
 * 连上之后立刻把钱包拨到 BSC。
 *
 * 为什么放在「连上之后」而不是页面加载时：授权之前钱包不会响应
 * wallet_switchEthereumChain，太早调用只会拿到 4100（unauthorized）。
 *
 * 这是网页能做的极限。钱包自己那一层「选择网络」弹窗属于 App 的
 * dapp 浏览器，在页面加载前就已发生，任何 JS 都够不着 —— 那一层只能靠
 * deeplink 参数（Bitget 的 _needChain、Trust 的 coin_id）。
 *
 * 返回值必须被调用方接住。之前这里一律吞异常，理由是「链不对只影响写交易，
 * 读数据走固定 RPC，页面照常显示余额」—— 但那个理由只在「用户看得懂为什么
 * 发不出去」时成立。实际上用户看到的是余额 0、点按钮没反应，
 * 这比直接告诉他「网络不对」糟糕得多。
 */
async function ensureBscChain(provider) {
  if (!provider || typeof provider.request !== 'function') return CHAIN_UNKNOWN;

  let current = null;
  let couldRead = false;
  try {
    current = await provider.request({ method: 'eth_chainId' });
    couldRead = true;
  } catch (e) {
    // 读不到 chainId 不代表链是错的，只代表我们没有证据。往下走一次 switch：
    // 有些钱包不支持 eth_chainId，但支持 wallet_switchEthereumChain。
  }

  if (current && String(current).toLowerCase() === BSC_CHAIN_ID) return CHAIN_OK;

  // 切链失败时，能给出的结论取决于前面有没有读到 chainId：
  // 读到过 → 确定在别的链上；没读到过 → 只能说「不确定」，措辞必须留余地，
  // 否则一个不支持 eth_chainId 的老钱包会被冤枉成「网络不对」。
  const failure = () => (couldRead ? CHAIN_WRONG : CHAIN_UNKNOWN);

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_ID }]
    });
    return CHAIN_OK;
  } catch (err) {
    // 4902 = 钱包里还没有这条链。补一次 addEthereumChain，添加后多数钱包会自己切过去。
    if (err && (err.code === 4902 || err.code === -32603)) {
      try {
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
        return CHAIN_OK;
      } catch (e) {
        return failure();
      }
    }
    // 4001（用户拒绝）和其它错误：链仍然是错的，交给 UI 说清楚。
    return failure();
  }
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
    if (url.searchParams.has(WC_RETURN_PARAM)) { url.searchParams.delete(WC_RETURN_PARAM); touched = true; }
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
  // null | 'wrong' | 'unknown'，见 ensureBscChain 上方的说明
  const [chainIssue, setChainIssue] = useState(null);
  const [error, setError] = useState('');
  // WalletConnect 中继是否可达。null = 还没探测过。
  //
  // 为什么需要这一层：中继的域名在部分网络下完全不可达，此时 SDK 会
  // 静默重试，界面永远停在「准备中」。与其让每个点钱包的人等一轮超时，
  // 不如先探一次 —— 通才走中继，不通就直接用内置浏览器。
  const [wcReachable, setWcReachable] = useState(WC_PROJECT_ID ? null : false);

  const optedOut = useRef(false);
  // 给下面的 watchdog 用的「当前是否已连上」。用 ref 而不是依赖 account，
  // 是为了让监听器绑一次就够，不会随每次状态变化重新注册。
  const accountRef = useRef(null);
  useEffect(() => { accountRef.current = account; }, [account]);

  // 发现浏览器里所有实现了 EIP-6963 的钱包
  useEffect(() => watchInjectedWallets(setInjectedWallets), []);

  const accept = useCallback((accounts, provider, via = 'injected') => {
    if (!accounts || !accounts.length) return false;
    optedOut.current = false;
    try { sessionStorage.removeItem(OPTOUT_KEY); } catch (e) { /* 无痕模式 */ }
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 无痕模式 */ }
    // via 记录这条连接是注入式还是 SDK 桥接。两者在断开时的处理不同：
    // SDK 的 provider 只认识自己那套方法，往里塞 wallet_revokePermissions
    // 会走到它的未知方法分支，轻则报错、重则把桥接状态弄乱。
    setAccount({ address: normalizeAddress(accounts[0]), provider, via });
    setError('');
    // 不等它：切链是后台动作，用户点完图标应当立刻看到页面。
    // 但结果要接住 —— 切不过去时页面需要一条明确的提示，
    // 否则用户看到的是「余额 0 + 按钮点不动」。
    ensureBscChain(provider).then((r) => {
      setChainIssue(r === CHAIN_OK ? null : r);
    }).catch(() => { /* ensureBscChain 内部已兜住所有异常 */ });
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
    let wcReturn = false;
    let mmReturn = false;
    try {
      const params = new URL(location.href).searchParams;
      fromWallet = params.get(AUTOCONNECT_PARAM) === '1';
      okxReturn = params.get(OKX_RETURN_PARAM) === '1';
      wcReturn = params.get(WC_RETURN_PARAM) === '1';
      mmReturn = params.get(MM_RETURN_PARAM) === '1';
    } catch (e) { /* 地址异常，按普通访问处理 */ }

    // 地址栏里没有标记也要恢复，两种很常见的情形：
    //   1. 钱包 App 回跳时把 query 拼掉了，只回到站点根地址；
    //   2. Chrome 发现这个 URL 已经开着，直接切回原标签 —— 地址栏根本不变。
    // 这两种情况下，*pending.js 里的本地标记是唯一的线索。
    if (hasOkxPending()) okxReturn = true;
    if (hasWcPending()) wcReturn = true;
    if (hasMmPending()) mmReturn = true;

    // 连过一次之后，这个浏览器里就存着一条会话：以后每次打开页面都该是
    // 已连接状态，而不是让用户再点一次。判断只看 localStorage 的键名，
    // 不下载 SDK —— 没连过的人一分钱都不用付。
    const okxStored = okxReturn || hasStoredOkxSession();
    const wcStored = !!(WC_PROJECT_ID && (wcReturn || hasStoredWcSession()));
    // MetaMask 的会话键名属于 SDK 内部实现，不去猜；只认「这个浏览器里用过」，
    // 有标记才值得把 SDK 拉下来问一次。
    const mmStored = mmReturn || hasMmSeen();

    // 参数一旦读进变量就没有用了，立刻从地址栏抹掉。
    // 放在这里而不是各个分支结尾：无论后面走静默恢复、主动授权还是无声退出，
    // 用户复制网址、刷新页面时都不会再看到它，也不会因此重复弹授权框。
    if (fromWallet || okxReturn || wcReturn || mmReturn) clearAutoconnectParam();

    const seenBefore = readFlag(localStorage, SEEN_KEY);
    let cancelled = false;

    // 注意这里只判断「是不是手机」。它决定等 provider 等多久：
    // 手机上有可能是钱包内置浏览器（注入晚一点），值得多等；
    // 桌面普通浏览器有扩展，注入是同步的。
    // 真正的「是否在钱包内置浏览器里」要等 provider 到手才能确认，见下面。
    const mobile = isMobile();

    (async () => {
      // MetaMask Connect 回跳：页面里没有 window.ethereum，会话在 MetaMask SDK
      // 自己的存储里。放在最前面，因为它是最新加入的一条通道，用户点完
      // 回来时等的是它 —— 先让别的通道白等一轮没有意义。
      if (mmStored && !okxReturn && !wcReturn) {
        if (mmReturn && !cancelled) setAutoConnecting(true);
        try {
          const { restoreMetaMask } = await import('./metamaskconnect');
          const restored = await restoreMetaMask({ windowMs: mmReturn ? 10000 : 2500 });
          if (!cancelled && restored) {
            clearMmPending();
            accept(restored.accounts, restored.provider, 'sdk');
            return;
          }
        } catch (e) { /* 恢复失败就当普通访问，页面上的 Connect 按钮仍然在 */ }
        finally {
          if (!cancelled) setAutoConnecting(false);
        }
        if (!cancelled) clearMmPending();
      }

      // OKX Connect 回跳：这个页面的浏览器里没有 window.ethereum，
      // 会话保存在 OKX SDK 自己的存储里，要单独去问它一句。
      // 动态 import 保证那块 SDK 只在真的需要时才下载。
      //
      // 刚从 WalletConnect 回来时跳过：用户这一次等的是 WC 的会话，
      // 为 OKX 白下 200KB 再失败一次，只会让「回来就已经连上」变成「回来等三秒」。
      if (okxStored && !wcReturn && !mmReturn) {
        // 刚从 App 回来才提示进度；普通刷新时安静恢复，别让用户看到一闪而过的状态。
        if (okxReturn && !cancelled) setAutoConnecting(true);
        try {
          const { restoreOkx } = await import('./okxconnect');
          const restored = await restoreOkx({ windowMs: okxReturn ? 10000 : 3000 });
          if (!cancelled && restored) {
            clearOkxPending();
            accept(restored.accounts, restored.provider, 'sdk');
            return;
          }
        } catch (e) { /* 恢复失败就当普通访问，页面上的 Connect 按钮仍然在 */ }
        finally {
          if (!cancelled) setAutoConnecting(false);
        }
        // 窗口期内没等到会话就作废标记，否则以后每次打开页面都会白跑一次恢复。
        if (!cancelled) clearOkxPending();
      }

      // WalletConnect 回跳：会话在中继上，SDK 已经把它从 localStorage 读回来了，
      // 只差 enable() 一次让 accounts 有值。等法和 OKX 完全一致。
      if (wcStored) {
        if (wcReturn && !cancelled) setAutoConnecting(true);
        try {
          const { restoreWc } = await import('./walletconnect');
          const restored = await restoreWc({ windowMs: wcReturn ? 10000 : 3000 });
          if (!cancelled && restored) {
            clearWcPending();
            accept(restored.accounts, restored.provider, 'sdk');
            return;
          }
        } catch (e) { /* 恢复失败就当普通访问 */ }
        finally {
          if (!cancelled) setAutoConnecting(false);
        }
        if (!cancelled) clearWcPending();
      }

      const eth = await waitForProvider(fromWallet || mobile ? 3000 : 1200);
      if (cancelled || !eth) return;

      // 到这里 eth 一定存在。移动端还有 provider = 一定在某个钱包的内置
      // 浏览器里（手机普通浏览器、微信、小米浏览器都不会注入）。
      //
      // 这个判据比 URL 上的 ?c=1 可靠得多：Trust、SafePal 的 deeplink
      // 都带不进 query，落地时地址栏是干净的，唯一能说明「用户就是为了
      // 连接才进来的」就是 provider 本身。
      //
      // 旧写法直接拿 isMobile() 当结论，语义是错的（手机会被误判成
      // 「一定在钱包里」），只是因为 !eth 提前 return 才没有出事。
      const inWalletBrowser = mobile;

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
    let alive = true;
    const start = () => {
      import('./okxconnect').then((m) => m.prefetchOkx()).catch(() => {});
      // WalletConnect 那块 400KB+，比 OKX 还重，而且在中继被封锁的网络里
      // 下下来一行也用不上。所以先花一个 HTTP 请求问「通吗」，通了才下。
      if (WC_PROJECT_ID) {
        import('./walletconnect')
          .then(async (m) => {
            const r = m.relayKnown() || await m.probeRelay();
            if (!alive) return;
            setWcReachable(r.ok);
            if (r.ok) await m.prefetchWc();
          })
          .catch(() => { if (alive) setWcReachable(false); });
      }
    };
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(start, { timeout: 3000 });
    } else {
      timer = setTimeout(start, 1500);
    }
    return () => {
      alive = false;
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      if (timer) clearTimeout(timer);
    };
  }, []);

  // 网络变了（4G 切 Wi-Fi、或反过来）就重探一次中继。
  // 探测结果带 5 分钟缓存，不这样处理的话，用户在 Wi-Fi 下连上、
  // 再切回移动网络，页面会一直以为中继还通着。
  useEffect(() => {
    if (typeof window === 'undefined' || !WC_PROJECT_ID) return;
    const onOnline = () => {
      import('./walletconnect')
        .then(async (m) => {
          const r = await m.probeRelay({ force: true });
          setWcReachable(r.ok);
          if (r.ok && isMobile()) m.warmWc();
        })
        .catch(() => { /* 探测本身失败就当没网，保持原判 */ });
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
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
      if (accept(accounts, provider, 'sdk')) { setPickerOpen(false); return true; }
      return false;
    } catch (e) {
      // 4001 / reject 是用户自己取消，不当作错误上报
      if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) return false;
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy, accept]);

  /**
   * 钱包墙上点 MetaMask：走 MetaMask Connect，不经过 WalletConnect。
   *
   * 和 connectOkxWallet 同构 —— 拿到的都是 EIP-1193 provider，
   * accept() 之后的逻辑一行都不用改。差别只在谁在中继：OKX 用自家 Connect，
   * MetaMask 用自家的 multichain relay。
   *
   * 这条路的价值在于：它是唯一不依赖 WalletConnect 的公共钱包通道。
   * WC 的中继被网络封掉时，OKX 和它是仅剩的两个还能「授权完自动回来」的入口。
   */
  const connectMetaMaskWallet = useCallback(async () => {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      const { connectMetaMask } = await import('./metamaskconnect');
      const { accounts, provider } = await connectMetaMask();
      if (accept(accounts, provider, 'sdk')) { setPickerOpen(false); return true; }
      return false;
    } catch (e) {
      if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) return false;
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy, accept]);

  /**
   * 提示条上那个「Switch」按钮：再试一次。
   * 用户可能在钱包里手动改了网络，或者刚才只是点错了「拒绝」。
   */
  const fixChain = useCallback(async () => {
    const provider = account && account.provider;
    if (!provider) return false;
    const r = await ensureBscChain(provider);
    setChainIssue(r === CHAIN_OK ? null : r);
    return r === CHAIN_OK;
  }, [account]);

  /**
   * 钱包墙上点其他钱包：走 WalletConnect。
   *
   * 和 connectOkxWallet 是同构的 —— 拿到的都是 EIP-1193 provider，
   * accept() 之后的逻辑一行都不用改。区别只在「谁在中继上」：
   * OKX 用自家的 Connect，其余钱包用 WalletConnect。
   *
   * 只有配置了 Project ID 才会走到这里；没配置时钱包墙仍然走内置浏览器。
   */
  const connectWcWallet = useCallback(async (wallet, opts) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      const { connectWc } = await import('./walletconnect');
      const { accounts, provider } = await connectWc(wallet, opts);
      if (accept(accounts, provider, 'sdk')) { setPickerOpen(false); return true; }
      return false;
    } catch (e) {
      if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) return false;
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy, accept]);

  /**
   * 钱包墙上点「浏览器钱包」：私钥在本地生成，授权框由本页渲染，
   * 全程不离开浏览器 —— 这是唯一一条不需要把 App 叫起来的路径。
   *
   * 拿到的仍然是 EIP-1193 provider，accept() 之后的逻辑一行都不用改，
   * 余额刷新、nonce 管理、回执轮询全部照旧（见 src/localwallet.js）。
   *
   * 错误不在这里吞：PIN 错误要让调用方区分出来显示「Wrong PIN」，
   * 而不是一句笼统的失败。
   */
  const connectLocal = useCallback(async (pin) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      const { connectLocalWallet } = await import('./localwallet');
      const { accounts, provider } = await connectLocalWallet(pin);
      if (accept(accounts, provider, 'sdk')) { setPickerOpen(false); return true; }
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy, accept]);

  const disconnect = useCallback(() => {
    optedOut.current = true;
    try { sessionStorage.setItem(OPTOUT_KEY, '1'); } catch (e) { /* noop */ }
    // 主动断开就把「来过」的记忆一起清掉，否则刷新一下又会被自动连回去
    try { localStorage.removeItem(SEEN_KEY); } catch (e) { /* noop */ }

    const provider = account && account.provider;
    const viaInjected = !!account && account.via !== 'sdk';

    // 顺序很关键：先断开界面，再去问钱包撤销授权。
    //
    // 旧写法是 await revoke 之后再 setAccount(null)，看起来更「干净」，
    // 实际上把一个可以永远不返回的 Promise 放在了关键路径上：
    //   · Trust 的桥接在会话已失效时不会回包；
    //   · OKX Connect 的 provider 在 App 侧断开后同样可能挂住。
    // 用户在那一秒里看到的是「点了没反应」，之后再点、再刷新，
    // 就变成了「断开钱包后页面崩溃」。
    //
    // revoke 只是锦上添花：它让下一次打开不再自动连回来，而这件事
    // sessionStorage 里的 optedOut 标记已经做到了。所以它必须异步、必须超时、
    // 必须失败也不影响本地状态。
    setAccount(null);
    setChainIssue(null);
    setPickerOpen(false);
    setError('');

    if (viaInjected && provider && typeof provider.request === 'function') {
      try {
        const revoke = provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        });
        // 3 秒封顶，超时就丢掉这个 Promise —— 不留任何悬挂的引用。
        const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
        Promise.race([Promise.resolve(revoke), timeout]).catch(() => {});
      } catch (e) { /* 同步抛出的钱包（部分 SDK）直接忽略 */ }
    }
  }, [account]);

  // 打开钱包墙就顺手开始下 SDK：从面板出现到用户点中某个图标，
  // 通常有 1~2 秒，这段空档正好用来下载。失败无所谓，点的时候还会再 import 一次。
  // WalletConnect 只在配置了 Project ID 时才预下 —— 没配置的人不该为这 300KB 付费。
  // 打开钱包墙就顺手开始准备：从面板出现到用户点中某个图标，
  // 通常有 1~2 秒，这段空档正好用来下载。
  //
  // OKX 那边只预热代码；WalletConnect 必须连「配对 URI」一起提前生成 ——
  // 否则点击之后才开始生成，跳转落在用户手势窗口之外，浏览器会静默丢弃。
  const openPicker = useCallback(() => {
    import('./okxconnect').then((m) => m.prefetchOkx()).catch(() => {});
    // MetaMask 那块比 OKX 还大，只在「这个浏览器用过」时才提前下 ——
    // 没用过的人不该为它付流量。
    if (hasMmSeen()) {
      import('./metamaskconnect').then((m) => m.prefetchMetaMask()).catch(() => {});
    }
    if (WC_PROJECT_ID) {
      import('./walletconnect')
        .then(async (m) => {
          const r = m.relayKnown() || await m.probeRelay();
          setWcReachable(r.ok);
          // 只有确认可达才预热配对。不可达时连 SDK 都不下 —— 那 400KB
          // 在被封锁的网络里下载下来，也只会换来一次超时。
          // 桌面不预热：钱包墙只在手机上出现，桌面走扩展或二维码。
          if (r.ok && isMobile()) m.warmWc();
        })
        .catch(() => setWcReachable(false));
    }
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
    chainIssue,
    fixChain,
    error,
    connect,
    connectWith,
    connectOkxWallet,
    connectMetaMaskWallet,
    connectWcWallet,
    connectLocal,
    wcReachable,
    disconnect,
    clearError: () => setError('')
  };
}
