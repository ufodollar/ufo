// ================= 钱包目录与唤起 =================
//
// 不依赖任何钱包 SDK。唤起方式按平台分三种，各有各的坑：
//
//   1. https universal link —— 装了由系统接管，没装落下载页。最安全，
//      但只有少数钱包（MetaMask / Trust / Coinbase）提供了这类入口。
//   2. Android intent:// —— 明确指定包名，没装会走 browser_fallback_url。
//      只写自定义 scheme 时，没装 App 的系统会静默丢弃，用户看到的是
//      「点了完全没反应」，这正是 OKX 之前的表现。
//   3. 自定义 scheme —— iOS 只能这样。没装时浏览器毫无反应，必须自己计时。
//
// 还有一类是「打开 App 但不进浏览器」：SafePal 官方明确说 deeplink 只拉起
// App，不会导航到内置浏览器。这类只能标 direct:false，进去后让用户粘贴。

const ICON = (id) => `/wallets/${id}.webp`;

export function platform() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'desktop';
}

/** 移动端才值得展示钱包墙；桌面浏览器没有注入时只能靠扩展或手机扫码 */
export function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent);
}

export function currentUrl() {
  return typeof location !== 'undefined' ? location.origin + '/' : 'https://ufo-eea.pages.dev/';
}

/**
 * 落地标记：从钱包图标跳进来时带上 ?c=1。
 *
 * 钱包内置浏览器打开一个「从没授权过」的站点时，eth_accounts 一定返回空数组
 * （MetaMask 如此，Trust Wallet 会直接放行，所以它看起来是秒连的）。
 * 页面只能靠这个标记知道「用户就是为了连接才进来的」，从而立刻主动发起
 * eth_requestAccounts —— 少一次点击，且不需要用户去页面上找按钮。
 *
 * 必须用 query 而不是 #hash：metamask.app.link 这类 https 中转是把目标地址
 * 当路径传给服务器再由服务端 302，而 # 之后的内容浏览器根本不发给服务器，
 * 会在中转环节被整段丢掉。query 才会被原样带进目标 URL 再落到页面上。
 */
export const AUTOCONNECT_PARAM = 'c';

export function autoconnectUrl() {
  return currentUrl() + '?' + AUTOCONNECT_PARAM + '=1';
}

/**
 * Android 专用：intent:// 带上包名，系统找不到目标就自动去
 * browser_fallback_url（下载页），不会再出现「点了没反应」。
 *
 * 语法是 intent://<host><path>#Intent;scheme=…;package=…;end，
 * 注意 host 是 scheme 里 // 后面那一段（okx://wallet/dapp/url 的 host 是 wallet），
 * 不是 scheme 本身。
 * package 名取自各钱包 Google Play 正式版本。
 */
function androidIntent(scheme, host, path, query, pkg, fallback) {
  const q = query ? '?' + query : '';
  return `intent://${host}${path}${q}#Intent;scheme=${scheme};` +
         `package=${pkg};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}

/**
 * 钱包清单。
 *
 * direct: true  → 能直接落进内置浏览器并加载本站
 * direct: false → 只能打开 App 本身，进去后要用户自己粘贴链接
 *                  （SafePal / Binance 属于后者，见各自注释）
 */
export function walletList() {
  // 落地即请求授权的地址：用户点图标的目的就是连接，不该让他进去再找按钮
  const target = autoconnectUrl();
  const bare = target.replace(/^https?:\/\//, '');
  const enc = encodeURIComponent(target);
  const p = platform();

  return [
    {
      id: 'metamask', name: 'MetaMask', direct: true,
      url: `https://metamask.app.link/dapp/${bare}`,
      fallback: 'https://metamask.io/download/'
    },
    {
      id: 'trust', name: 'Trust Wallet', direct: true,
      url: `https://link.trustwallet.com/open_url?coin_id=60&url=${enc}`,
      fallback: 'https://trustwallet.com/download'
    },
    {
      id: 'okx', name: 'OKX Wallet', direct: true,
      // Android 必须走 intent：只给 okx:// 时，已安装的 OKX 也可能不响应，
      // 用户看到的就是「提示未安装」。
      url: p === 'android'
        ? androidIntent('okx', 'wallet', '/dapp/url', `dappUrl=${enc}`, 'com.okinc.okex.gp', 'https://www.okx.com/web3')
        : `okx://wallet/dapp/url?dappUrl=${enc}`,
      fallback: 'https://www.okx.com/web3',
      scheme: p !== 'android',
      intent: p === 'android'
    },
    {
      id: 'bitget', name: 'Bitget Wallet', direct: true,
      url: `https://bkcode.vip?action=dapp&url=${enc}`,
      fallback: 'https://web3.bitget.com/'
    },
    {
      id: 'tokenpocket', name: 'TokenPocket', direct: true,
      // chain 显式声明 BSC，部分版本会据此预选网络
      url: `tpdapp://open?params=${encodeURIComponent(JSON.stringify({ url: target, chain: 'BSC' }))}`,
      fallback: 'https://www.tokenpocket.pro/',
      scheme: true
    },
    {
      id: 'phantom', name: 'Phantom', direct: true,
      // 官方格式：url 作为路径段整段编码，ref 是发起方地址
      url: `https://phantom.com/ul/browse/${enc}?ref=${enc}`,
      fallback: 'https://phantom.app/download'
    },
    {
      id: 'safepal', name: 'SafePal', direct: false,
      // SafePal 官方文档明确：deeplink 只拉起 App，不会导航到内置浏览器，
      // 也不会自动加载传入的 URL。任何参数组合都改变不了这个行为。
      // 所以点它之后：复制链接 + 打开 App，由用户自己粘贴。
      url: `https://link.safepal.io/wallet/openurl?url=${enc}`,
      fallback: 'https://www.safepal.com/download'
    },
    {
      id: 'imtoken', name: 'imToken', direct: true,
      url: `imtokenv2://navigate/DappView?url=${enc}`,
      fallback: 'https://token.im/download',
      scheme: true
    },
    {
      id: 'coinbase', name: 'Coinbase Wallet', direct: true,
      url: `https://go.cb-w.com/dapp?cb_url=${enc}`,
      fallback: 'https://www.coinbase.com/wallet/downloads'
    },
    {
      id: 'binance', name: 'Binance Wallet', direct: false,
      // Binance 收到这个 deeplink 后只显示一段「长按复制 URL 用浏览器打开」，
      // 不加载页面 —— 它对未收录域名有额外的安全拦截（pages.dev 这类共享域
      // 尤其明显）。同样降级成「复制 + 打开 App」。
      url: `bnc://app.binance.com/cedefi/dapp?url=${enc}`,
      fallback: 'https://www.binance.com/en/web3wallet',
      scheme: true
    }
  ].map((w) => ({ ...w, icon: ICON(w.id), target }));
}

/**
 * 在钱包 App 的内置浏览器里打开本站。
 * 落地后页面里已经有 window.ethereum，注入式逻辑会自动恢复连接。
 */
export function openInWallet(wallet) {
  // intent:// 自带 browser_fallback_url，系统会处理「没装」的情况，
  // 不需要我们再计时判断
  if (wallet.intent) { location.href = wallet.url; return; }

  if (!wallet.scheme) {
    // https：装了 App 由系统接管，没装就是下载页
    location.href = wallet.url;
    return;
  }

  // 自定义 scheme：没装时浏览器毫无反应，1.8 秒还不走就当作没装
  let left = false;
  const timer = setTimeout(() => {
    if (!left) location.href = wallet.fallback;
  }, 1800);

  const stop = () => {
    if (document.visibilityState === 'hidden') {
      left = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', stop);
    }
  };
  document.addEventListener('visibilitychange', stop);

  location.href = wallet.url;
}

/**
 * EIP-6963：浏览器里已经装好的扩展钱包会通过事件自报家门。
 * 这是 W3C 标准，MetaMask / OKX / Bitget / Coinbase / Rabby 都实现了。
 * 好处是能拿到「用户真正装了的那个」，而不是猜。
 */
export function watchInjectedWallets(onChange) {
  if (typeof window === 'undefined') return () => {};

  const found = new Map();
  const onAnnounce = (event) => {
    const detail = event.detail;
    if (!detail || !detail.info || !detail.provider) return;
    found.set(detail.info.uuid, detail);
    onChange(Array.from(found.values()));
  };

  window.addEventListener('eip6963:announceProvider', onAnnounce);
  // 请求一次，让已注入的钱包立刻回话
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  // 有些扩展注入得晚，再补两次广播
  const t1 = setTimeout(() => window.dispatchEvent(new Event('eip6963:requestProvider')), 400);
  const t2 = setTimeout(() => window.dispatchEvent(new Event('eip6963:requestProvider')), 1500);

  return () => {
    window.removeEventListener('eip6963:announceProvider', onAnnounce);
    clearTimeout(t1);
    clearTimeout(t2);
  };
}
