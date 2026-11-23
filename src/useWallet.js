import { useState, useEffect, useCallback } from 'react';
import {
  localAddress,
  createLocalWallet,
  unlockLocalWallet,
  restoreLocalWallet,
  destroyLocalWallet,
  exportMnemonic,
  lockLocalWallet,
  isUnlocked,
  hasBackedUp,
  markBackedUp
} from './localwallet';

// ============================================================================
// UFO 官方钱包
// ----------------------------------------------------------------------------
// 这里只剩一条路径：钱包就在这个页面里。没有 window.ethereum 探测，没有钱包墙，
// 没有 WalletConnect / OKX Connect / MetaMask Connect —— 那八条通道分别依赖
// 「钱包 App 内置浏览器」和「公共中继」，前者把用户推去 App 首页，后者在这条
// 线路上建不起长连接。两者都不该出现在「官方钱包」的入口里。
//
// 用户第一件事是生成一个钱包：本页生成 BIP-39 助记词，用 6 位 PIN 加密后
// 存进 localStorage，签名在浏览器内完成（实现见 localwallet.js）。
// ============================================================================

export function useWallet() {
  // { address, provider }
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 这台浏览器里是否已有钱包（只看本地有没有记录，不需要 PIN）
  const [hasWallet, setHasWallet] = useState(false);
  // 有钱包但本次会话未解锁（刷新后必然如此：解密后的私钥只在内存里）
  const [locked, setLocked] = useState(false);
  // 用户是否确认抄写过助记词。没抄的人刷新一次就可能永久失去这个钱包，
  // 所以界面会一直留着一条提醒，直到他走过一次备份流程。
  const [backedUp, setBackedUp] = useState(false);

  useEffect(() => {
    const addr = localAddress();
    setHasWallet(!!addr);
    setBackedUp(hasBackedUp());
    if (!addr) return;

    // 同一会话里的热重载不该让用户重新输 PIN
    if (isUnlocked()) {
      const r = restoreLocalWallet();
      if (r) setAccount({ address: r.accounts[0], provider: r.provider });
    } else {
      setLocked(true);
    }
  }, []);

  /**
   * 生成钱包。返回 { address, mnemonic } —— 助记词只出现这一次，
   * 调用方必须立刻展示并要求抄写，不能存进任何不是用户手写的地方。
   */
  const create = useCallback(async (pin) => {
    if (busy) throw new Error('Already working.');
    setBusy(true);
    setError('');
    try {
      const r = await createLocalWallet(pin);
      const restored = restoreLocalWallet();
      setAccount({ address: r.address, provider: restored.provider });
      setHasWallet(true);
      setLocked(false);
      setBackedUp(false);   // 助记词还没被抄下来
      return r;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const unlock = useCallback(async (pin) => {
    setBusy(true);
    setError('');
    try {
      const r = await unlockLocalWallet(pin);
      const restored = restoreLocalWallet();
      setAccount({ address: r.address, provider: restored.provider });
      setLocked(false);
      return r;
    } catch (e) {
      // BAD_PIN 是「口令错」，其它是「这台设备上没有钱包」之类。
      // 两者 UI 上要分开说，不能都显示成一句失败。
      const msg = e && e.code === 'BAD_PIN' ? 'Wrong PIN.' : (e && e.message ? e.message : String(e));
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * 锁上，但**不删除**。私钥仍在这台设备上，下次输 PIN 就能回来。
   * 与「删除钱包」必须区分开：锁是日常动作，删是不可逆的。
   */
  const lock = useCallback(() => {
    lockLocalWallet();
    setAccount(null);
    setLocked(true);
    setError('');
  }, []);

  /** 删除钱包。助记词一旦没抄，这里就是永久丢失，UI 必须二次确认。 */
  const remove = useCallback(() => {
    destroyLocalWallet();
    setAccount(null);
    setHasWallet(false);
    setLocked(false);
    setError('');
  }, []);

  /** 导出助记词（需要 PIN）。用于用户换设备或导进别的钱包。 */
  const exportKey = useCallback(async (pin) => exportMnemonic(pin), []);

  /** 用户确认已抄写。只影响提示，不影响密钥本身。 */
  const confirmBackup = useCallback(() => {
    markBackedUp();
    setBackedUp(true);
  }, []);

  return {
    address: account ? account.address : null,
    provider: account ? account.provider : null,
    isConnected: !!account,
    busy,
    error,
    hasWallet,
    locked,
    backedUp,

    create,
    unlock,
    lock,
    remove,
    exportKey,
    confirmBackup,

    // 本地钱包只有一个网络：chainId 固定返回 0x38，切换请求直接成功。
    // 这两个字段保留是为了让 App 那边「连接后确认网络」的既有逻辑不必分叉。
    chainIssue: null,
    fixChain: async () => 'ok',

    clearError: () => setError('')
  };
}
