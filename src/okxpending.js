// ============================================================================
// OKX Connect 的「正在等回跳」标记
// ----------------------------------------------------------------------------
// 为什么需要它，而不是只看地址栏上的 ?okx=1：
//
//   1. 钱包回跳时，query 可能被 App 重新拼 URL 时丢掉；
//   2. 更关键的是 Chrome 的标签去重：如果回跳地址和某个已打开的标签完全一致，
//      Chrome 会切到那个标签而不是新开一个 —— 地址栏里的参数根本来不及出现。
//      这正是我们想要的「最快路径」：原页面还活着，那笔 connect() 的 Promise
//      直接 resolve，用户回到页面时已经是连接状态，一帧都不用等。
//   3. 反过来，如果页面被系统回收、回来时是新标签，URL 参数也可能是空的，
//      只有 localStorage 两个标签共享，是唯一两边都靠得住的信号。
//
// 所以：点 OKX 图标时写标记，连接成功或确定放弃时清掉。
// 标记带 20 分钟有效期：用户点了图标又直接杀进程，回来也不会永远卡在「恢复中」。
// ============================================================================

const KEY = 'ufo_okx_pending';
const TTL = 20 * 60 * 1000;

export function markOkxPending() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* 无痕模式 */ }
}

export function clearOkxPending() {
  try { localStorage.removeItem(KEY); } catch (e) { /* 无痕模式 */ }
}

export function hasOkxPending() {
  try {
    const at = Number(localStorage.getItem(KEY) || 0);
    return !!at && Date.now() - at < TTL;
  } catch (e) {
    return false;
  }
}

/**
 * 这个浏览器里是否存着一条 OKX Connect 会话 —— 不加载 SDK 就能判断。
 *
 * SDK 把会话写在 localStorage 的一个 JSON 里，键名形如
 *   OKXStorageKeyck_dapp<dapp 名> = { "cspk_connectSession": {...}, ... }
 * 只需要扫一眼键名，不必解密、不必下载那 200KB。
 *
 * 用途：老用户刷新页面时直接恢复成「已连接」，
 * 而没连过的人一次都不用付这笔下载。
 */
export function hasStoredOkxSession() {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('OKXStorageKey') !== 0) continue;
      const v = localStorage.getItem(k) || '';
      if (v.indexOf('cspk_connectSession') !== -1) return true;
    }
  } catch (e) { /* 无痕模式 / 存储被禁用 */ }
  return false;
}
