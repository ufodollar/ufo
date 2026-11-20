import { useState, useEffect, useCallback, useRef } from 'react';
import { ensureAppKit, getModal, WC_MARK_KEY } from './wallet';

// 本会话主动断开后，不要再用注入式自动连回去
const OPTOUT_KEY = 'ufo_inj_off';

// 地址统一小写。
// 不用 ethers 的 getAddress：它会对混合大小写做 EIP-55 校验和验证，
// 钱包返回不规范的地址时会抛错，导致「有地址却显示未连接」。
// 界面上只显示 0xabc…1234，大小写对用户没有任何区别，
// 而省掉 ethers/address 这条依赖链又少 10KB。
function normalizeAddress(addr) {
  return String(addr || '').toLowerCase();
}

function readFlag(storage, key) {
  try { return storage.getItem(key) === '1'; } catch (e) { return false; }
}

/**
 * 统一钱包状态。
 *
 * 两个来源，优先级固定：
 *   injected —— window.ethereum，钱包 App 内置浏览器 / 装了扩展的桌面浏览器。
 *               打开页面即静默恢复（eth_accounts 不需要用户操作），零网络开销。
 *   appkit   —— WalletConnect / 社交登录，只有页面里没有注入时才会被拉起。
 *
 * 对上层暴露的仍然是老三样：address / provider / isConnected，
 * 业务代码（切链、签交易、读余额）完全不用区分来源。
 */
export function useWallet() {
  const [injected, setInjected] = useState(null);   // { address, provider }
  const [appkitAccount, setAppkitAccount] = useState({ address: null, isConnected: false, status: 'disconnected' });
  const [appkitProvider, setAppkitProvider] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const injectedOptOut = useRef(false);
  const subscribed = useRef(false);

  // 订阅 AppKit 的账户与 provider 变化，写回本地 state。
  // 用订阅而不是 hook，是为了让 AppKit 整个从首屏 bundle 里消失。
  const subscribeModal = useCallback((modal) => {
    if (!modal || subscribed.current) return;
    subscribed.current = true;

    modal.subscribeAccount((acc) => {
      setAppkitAccount({
        address: acc && acc.address ? normalizeAddress(acc.address) : null,
        isConnected: !!(acc && acc.isConnected),
        status: (acc && acc.status) || 'disconnected'
      });
      if (acc && acc.isConnected) {
        try { localStorage.setItem(WC_MARK_KEY, '1'); } catch (e) { /* 无痕模式 */ }
        setError('');
      }
    });

    modal.subscribeProviders((providers) => {
      setAppkitProvider((providers && providers['eip155']) || null);
    });
  }, []);

  // ---- 注入式：进入页面就尝试静默恢复 ----
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? window.ethereum : null;
    if (!eth) return;

    const off = readFlag(sessionStorage, OPTOUT_KEY);
    injectedOptOut.current = off;

    let cancelled = false;
    const adopt = (accounts) => {
      if (cancelled) return;
      if (accounts && accounts.length) {
        setInjected({ address: normalizeAddress(accounts[0]), provider: eth });
      } else {
        setInjected(null);
      }
    };

    if (!off) {
      (async () => {
        try { adopt(await eth.request({ method: 'eth_accounts' })); }
        catch (e) { adopt(null); }
      })();
    }

    const onAccounts = (accounts) => {
      if (injectedOptOut.current) return;
      adopt(accounts);
    };

    try { eth.on?.('accountsChanged', onAccounts); } catch (e) { /* 个别钱包不支持事件 */ }
    return () => {
      cancelled = true;
      try { eth.removeListener?.('accountsChanged', onAccounts); } catch (e) { /* noop */ }
    };
  }, []);

  // ---- AppKit 的加载时机 ----
  // 只有一种情况会在首屏自动加载：访客以前用 WalletConnect 连过。
  // 不预取。AppKit 全家桶解压后 4MB 出头，对手机流量和低端机的解析都是实打实的成本；
  // 为了「点连接时快 1 秒」而让每个只看汇率的访客多下 1.5MB，不划算。
  // 没注入钱包的访客点头像时才下载，那时界面已经有 loading 文案。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.ethereum) return;
    if (!readFlag(localStorage, WC_MARK_KEY)) return;

    ensureAppKit().then(subscribeModal).catch(() => {});
  }, [subscribeModal]);

  const connect = useCallback(async () => {
    if (busy) return;
    setError('');

    // 1) 有注入：直接连，不下载任何东西
    const eth = typeof window !== 'undefined' ? window.ethereum : null;
    if (eth) {
      setBusy(true);
      try {
        const accounts = await eth.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts.length) {
          injectedOptOut.current = false;
          try { sessionStorage.removeItem(OPTOUT_KEY); } catch (e) { /* noop */ }
          setInjected({ address: normalizeAddress(accounts[0]), provider: eth });
          return;
        }
      } catch (e) {
        // 4001 = 用户主动取消。安静退出，也不该再弹 WalletConnect 去打扰他。
        if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED')) return;
        // 其他异常继续尝试 WalletConnect
      } finally {
        setBusy(false);
      }
    }

    // 2) 无注入：按需加载 AppKit，再开弹窗
    setBusy(true);
    try {
      const modal = await ensureAppKit();
      subscribeModal(modal);
      await modal.open({ view: 'AllWallets' });
    } catch (e) {
      setError('Could not open the wallet selector. Please open this page inside your wallet app.');
    } finally {
      setBusy(false);
    }
  }, [busy, subscribeModal]);

  const close = useCallback(async () => {
    const modal = getModal();
    if (!modal) return;
    try { await modal.close(); } catch (e) { /* noop */ }
  }, []);

  const disconnect = useCallback(async () => {
    injectedOptOut.current = true;
    try { sessionStorage.setItem(OPTOUT_KEY, '1'); } catch (e) { /* noop */ }
    setInjected(null);

    const modal = getModal();
    if (modal) {
      try { await modal.disconnect('eip155'); } catch (e) { /* noop */ }
    }
    try { localStorage.removeItem(WC_MARK_KEY); } catch (e) { /* noop */ }
    setAppkitAccount({ address: null, isConnected: false, status: 'disconnected' });
    setAppkitProvider(null);
  }, []);

  return {
    address: appkitAccount.address || (injected && injected.address) || null,
    provider: appkitProvider || (injected && injected.provider) || null,
    isConnected: appkitAccount.isConnected || !!(injected && injected.address),
    source: appkitAccount.isConnected ? 'walletconnect' : (injected && injected.address ? 'injected' : null),
    busy,
    error,
    connect,
    close,
    disconnect,
    clearError: () => setError('')
  };
}
