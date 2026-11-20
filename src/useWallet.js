import { useState, useEffect, useCallback, useRef } from 'react';
import { watchInjectedWallets, AUTOCONNECT_PARAM } from './wallets';

// 本会话主动断开后，不要再用注入式自动连回去
const OPTOUT_KEY = 'ufo_inj_off';

// 这个浏览器里成功连接过一次。
// 只写在钱包内置浏览器自己的 WebView 存储里，与手机上的 Chrome 互不相通，
// 所以它只表达一件事：「这个人上次在这里连过」—— 再进来时直接续上。
const SEEN_KEY = 'ufo_linked';

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

/** 用过就把 c=1 从地址栏去掉，避免用户手动刷新时又弹一次授权框 */
function clearAutoconnectParam() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(AUTOCONNECT_PARAM)) return;
    url.searchParams.delete(AUTOCONNECT_PARAM);
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
    try {
      fromWallet = new URL(location.href).searchParams.get(AUTOCONNECT_PARAM) === '1';
    } catch (e) { /* 地址异常，按普通访问处理 */ }

    // 参数一旦读进变量就没有用了，立刻从地址栏抹掉。
    // 放在这里而不是各个分支结尾：无论后面走静默恢复、主动授权还是无声退出，
    // 用户复制网址、刷新页面时都不会再看到它，也不会因此重复弹授权框。
    if (fromWallet) clearAutoconnectParam();

    const seenBefore = readFlag(localStorage, SEEN_KEY);
    let cancelled = false;

    (async () => {
      const eth = await waitForProvider(fromWallet ? 3000 : 1200);
      if (cancelled || !eth) return;

      // 1) 已授权：静默恢复，不弹任何东西
      try {
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (cancelled) return;
        if (accounts && accounts.length) { accept(accounts, eth); return; }
      } catch (e) { /* 未授权，继续往下判断 */ }

      if (cancelled || (!fromWallet && !seenBefore)) return;

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

  return {
    address: account ? account.address : null,
    provider: account ? account.provider : null,
    isConnected: !!account,
    source: account ? 'injected' : null,
    injectedWallets,
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    busy,
    autoConnecting,
    error,
    connect,
    connectWith,
    disconnect,
    clearError: () => setError('')
  };
}
