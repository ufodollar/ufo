// ============================================================================
// WalletConnect 的「正在等回跳」标记
// ----------------------------------------------------------------------------
// 和 okxpending.js 是同一套思路，但键必须分开：两个通道的恢复流程完全不同，
// 共用一个标记会让 OKX 的回跳去触发 WalletConnect 的恢复（或反过来），
// 结果是白下载 300KB 再失败一次。
//
// 为什么不能只看地址栏的 ?wc=1：
//   钱包把用户送回浏览器时，URL 可能是原来那个（Chrome 复用标签），
//   也可能被 App 重新拼过、参数丢失。localStorage 是两个标签唯一共享的信号。
// ============================================================================

const KEY = 'ufo_wc_pending';
const TTL = 20 * 60 * 1000;

export function markWcPending() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* 无痕模式 */ }
}

export function clearWcPending() {
  try { localStorage.removeItem(KEY); } catch (e) { /* 无痕模式 */ }
}

export function hasWcPending() {
  try {
    const at = Number(localStorage.getItem(KEY) || 0);
    return !!at && Date.now() - at < TTL;
  } catch (e) {
    return false;
  }
}

/**
 * 这个浏览器里是否存着一条 WalletConnect 会话 —— 不加载 SDK 就能判断。
 *
 * SDK 的存储键形如 `wc@2:client:0.3//session`，值是会话数组的 JSON。
 * 只扫键名 + 看数组是否非空，不解密、不下载那 300KB。
 *
 * 用途和老用户刷新页面一样：连过一次之后，再打开页面应当直接是已连接，
 * 而不是让用户重新点一次、再切一次 App。
 */
export function hasStoredWcSession() {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('wc@2:client') !== 0 || k.indexOf('session') === -1) continue;
      const v = (localStorage.getItem(k) || '').replace(/[\s[\]]/g, '');
      if (v.length > 2) return true;
    }
  } catch (e) { /* 无痕模式 / 存储被禁用 */ }
  return false;
}
