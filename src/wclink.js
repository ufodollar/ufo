// ============================================================================
// 配对 URI 的中转箱
// ----------------------------------------------------------------------------
// 为什么需要单独一个模块，而不是让 WalletPicker 直接从 walletconnect.js 里取：
//
// WalletConnect 的配对 URI 是「本地生成 + 通过中继发布」的，必须先把 SDK 跑起来
// （400KB+）并完成一次 relay 握手。而移动端浏览器只承认「用户手势」发起的跳转，
// 这个窗口在 Chrome 上是 5 秒。
//
// 如果点了图标才开始下载 SDK，5 秒的窗口必然过期，location.href 会被静默丢弃 ——
// 用户看到的就是「点了没反应」，页面还停在钱包墙上。
//
// 所以生成方（walletconnect.js，懒加载 chunk）在钱包墙打开时就把 URI 提前投进这里，
// 点击方（WalletPicker，主包）静态引入、同步读出、同步导航。这个文件必须零依赖，
// 否则它会把整条懒加载链拖进首屏。
// ============================================================================

let uri = null;
let stamp = 0;

// WalletConnect 的 pairing 本身有 5 分钟寿命，留 1 分钟余量。
const TTL = 4 * 60 * 1000;

export function setWcUri(value) {
  uri = value || null;
  stamp = Date.now();
}

export function clearWcUri() {
  uri = null;
  stamp = 0;
}

/** 同步读取。没有、或已经过期，都返回 null。 */
export function getWcUri() {
  if (!uri) return null;
  if (Date.now() - stamp > TTL) { uri = null; stamp = 0; return null; }
  return uri;
}
