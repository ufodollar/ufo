// ============================================================================
// MetaMask 通道的「正在等回跳」与「用过」标记
// ----------------------------------------------------------------------------
// 和 okxpending.js 同一个思路，独立 key，两条通道互不干扰。
//
// 为什么必须用 localStorage 而不是只看地址栏：
//   1. 钱包回跳时 query 可能被 App 重新拼 URL 时丢掉；
//   2. Chrome 的标签去重会让回跳直接切回已打开的原标签，地址栏根本不变；
//   3. 页面若在 App 内被系统回收，回来是全新加载，只有本地标记能说明
//      「刚才有一次连接没走完」。
// ============================================================================

const PENDING_KEY = 'ufo_mm_pending';
const SEEN_KEY = 'ufo_mm_seen';
// 用户点了图标又直接杀进程，回来不该永远卡在「恢复中」
const PENDING_TTL = 20 * 60 * 1000;

export function markMmPending() {
  try { localStorage.setItem(PENDING_KEY, String(Date.now())); } catch (e) { /* 无痕模式 */ }
}

export function clearMmPending() {
  try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* 无痕模式 */ }
}

export function hasMmPending() {
  try {
    const at = Number(localStorage.getItem(PENDING_KEY) || 0);
    return !!at && Date.now() - at < PENDING_TTL;
  } catch (e) {
    return false;
  }
}

/**
 * 这个浏览器里用过 MetaMask 通道。
 *
 * 用途只有一个：决定要不要在页面空闲时把那块 SDK 下下来。
 * 没用过的人一个字节都不该付 —— 它比 OKX 那块还大。
 */
export function markMmSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* 无痕模式 */ }
}

export function hasMmSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; }
}
