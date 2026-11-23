import { useState, useEffect, useCallback } from 'react';
import {
  localAddress,
  localAccounts,
  activeAccountId,
  createLocalWallet,
  importLocalWallet,
  unlockLocalWallet,
  switchAccount as switchLocalAccount,
  removeAccount as removeLocalAccount,
  restoreLocalWallet,
  destroyLocalWallet,
  exportPrivateKey,
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
// 账户模型：一个 6 位 PIN 保护一个 vault，vault 里可以挂多个私钥账户。
// 生成 / 导入都走 addAccount 那条路，切换账户在解锁状态下不需要再输 PIN
// （密钥已经派生在内存里），刷新后重新输一次即可。
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
  // 用户是否已经保存过私钥。没存的人刷新/清缓存后可能永久失去这个钱包，
  // 所以界面会一直留着一条提醒，直到他走过一次保存流程。
  const [backedUp, setBackedUp] = useState(false);

  // 账户列表（只有地址）。active 由 account.address 决定。
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const refreshAccounts = useCallback(() => {
    const list = localAccounts();
    setAccounts(list);
    setActiveId(activeAccountId());
    return list;
  }, []);

  useEffect(() => {
    const addr = localAddress();
    setHasWallet(!!addr);
    setBackedUp(hasBackedUp());
    refreshAccounts();
    if (!addr) return;

    // 同一会话里的热重载不该让用户重新输 PIN
    if (isUnlocked()) {
      const r = restoreLocalWallet();
      if (r) setAccount({ address: r.accounts[0], provider: r.provider });
    } else {
      setLocked(true);
    }
  }, [refreshAccounts]);

  // 绑定当前账户。这里必须同时刷新 activeId：顶部的账户编号读的是它，
  // 只更新地址而漏掉编号，就会出现「切到账户 2 了、顶上还写着账户 1」。
  const bindActive = useCallback(() => {
    const restored = restoreLocalWallet();
    if (!restored) return null;
    setAccount({ address: restored.accounts[0], provider: restored.provider });
    setActiveId(activeAccountId());
    return restored;
  }, []);

  /**
   * 生成新账户（私钥类型）。返回 { address, privateKey } ——
   * 私钥只在这一刻出现，调用方必须立刻展示并允许复制。
   * 已有钱包且已解锁时不需要 pin。
   */
  const create = useCallback(async (pin) => {
    if (busy) throw new Error('Already working.');
    setBusy(true);
    setError('');
    try {
      const r = await createLocalWallet(pin);
      bindActive();
      setHasWallet(true);
      setLocked(false);
      setBackedUp(false);   // 私钥还没被保存下来
      refreshAccounts();
      return r;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy, bindActive, refreshAccounts]);

  /** 导入私钥。参数与 create 一致：已有 vault 时 pin 可以不传。 */
  const importKey = useCallback(async (privateKey, pin) => {
    if (busy) throw new Error('Already working.');
    setBusy(true);
    setError('');
    try {
      const r = await importLocalWallet(privateKey, pin);
      bindActive();
      setHasWallet(true);
      setLocked(false);
      setBackedUp(true);    // 私钥本来就是用户自己带进来的
      refreshAccounts();
      return r;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy, bindActive, refreshAccounts]);

  const unlock = useCallback(async (pin) => {
    setBusy(true);
    setError('');
    try {
      const r = await unlockLocalWallet(pin);
      bindActive();
      setLocked(false);
      refreshAccounts();
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
  }, [bindActive, refreshAccounts]);

  /** 切换账户。必须在解锁状态下（否则 UI 先走 unlock）。 */
  const switchTo = useCallback(async (id) => {
    setBusy(true);
    setError('');
    try {
      const r = await switchLocalAccount(id);
      // 直接用返回值定位新账户，不再回读一次 localStorage：
      // 在存储不可写（隐私模式）的浏览器里，回读结果可能还是旧的 active，
      // 于是顶部编号与链上余额都停在上一个账户 —— 表现就是「切换没生效」。
      if (r && r.address) {
        const restored = restoreLocalWallet();
        setAccount({ address: r.address, provider: restored ? restored.provider : null });
      } else {
        bindActive();
      }
      refreshAccounts();
      return r;
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setError(msg);
      throw e;
    } finally {
      setBusy(false);
    }
  }, [bindActive, refreshAccounts]);

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

  /**
   * 删除单个账户。删掉最后一个等于删掉整个钱包。
   * 只是删本机的密文，链上资产不受影响 —— 但没保存私钥的人会永久失去这个地址，
   * 所以 UI 上必须二次确认。
   */
  const removeAccount = useCallback((id) => {
    const r = removeLocalAccount(id);
    refreshAccounts();
    if (!r.remaining) {
      setAccount(null);
      setHasWallet(false);
      setLocked(false);
      setBackedUp(false);
      setAccounts([]);
    } else {
      bindActive();
    }
    return r;
  }, [refreshAccounts, bindActive]);

  /** 删除钱包。私钥一旦没保存，这里就是永久丢失，UI 必须二次确认。 */
  const remove = useCallback(() => {
    destroyLocalWallet();
    setAccount(null);
    setHasWallet(false);
    setLocked(false);
    setAccounts([]);
    setError('');
  }, []);

  /** 查看 / 导出私钥（每次都重新输 PIN）。 */
  const viewKey = useCallback(async (pin, id) => exportPrivateKey(pin, id), []);

  /** 用户确认已保存私钥。只影响提示，不影响密钥本身。 */
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
    accounts,
    activeId,

    create,
    importKey,
    unlock,
    lock,
    remove,
    removeAccount,
    switchTo,
    viewKey,
    confirmBackup,

    // 本地钱包只有一个网络：chainId 固定返回 0x38，切换请求直接成功。
    // 这两个字段保留是为了让 App 那边「连接后确认网络」的既有逻辑不必分叉。
    chainIssue: null,
    fixChain: async () => 'ok',

    clearError: () => setError('')
  };
}
