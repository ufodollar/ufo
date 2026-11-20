import { useState, useEffect, useCallback, useRef } from 'react';
import { watchInjectedWallets } from './wallets';

// 本会话主动断开后，不要再用注入式自动连回去
const OPTOUT_KEY = 'ufo_inj_off';

// 地址统一小写。
// 不用 ethers 的 getAddress：它会对混合大小写做 EIP-55 校验和验证，
// 钱包返回不规范的地址时会抛错，导致「有地址却显示未连接」。
function normalizeAddress(addr) {
  return String(addr || '').toLowerCase();
}

function readFlag(storage, key) {
  try { return storage.getItem(key) === '1'; } catch (e) { return false; }
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
  const [error, setError] = useState('');

  const optedOut = useRef(false);

  // 发现浏览器里所有实现了 EIP-6963 的钱包
  useEffect(() => watchInjectedWallets(setInjectedWallets), []);

  // ---- 进入页面就尝试静默恢复（钱包内置浏览器的主要路径）----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const eth = window.ethereum;
    if (!eth) return;

    optedOut.current = readFlag(sessionStorage, OPTOUT_KEY);
    if (optedOut.current) return;

    let cancelled = false;
    (async () => {
      try {
        const accounts = await eth.request({ method: 'eth_accounts' });
        if (!cancelled && accounts && accounts.length) {
          setAccount({ address: normalizeAddress(accounts[0]), provider: eth });
        }
      } catch (e) {
        // 未授权，保持未连接
      }
    })();

    return () => { cancelled = true; };
  }, []);

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

  const accept = useCallback((accounts, provider) => {
    if (!accounts || !accounts.length) return false;
    optedOut.current = false;
    try { sessionStorage.removeItem(OPTOUT_KEY); } catch (e) { /* 无痕模式 */ }
    setAccount({ address: normalizeAddress(accounts[0]), provider });
    setError('');
    return true;
  }, []);

  // 主入口：有注入就直接连；多个扩展或没有注入才弹选择器
  const connect = useCallback(async () => {
    if (busy) return;
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
  }, [busy, accept, injectedWallets]);

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
    error,
    connect,
    connectWith,
    disconnect,
    clearError: () => setError('')
  };
}
