// ================= 钱包目录与唤起 =================
//
// 这里不依赖任何钱包 SDK。原理只有两条：
//   1. universal link（https://…）—— 系统拦截或落到下载页，天然安全；
//   2. 自定义 scheme（okx:// / tpdapp:// …）—— 没装 App 时浏览器毫无反应，
//      必须自己计时判断，否则用户点了像坏了一样。
//
// 图标是各钱包在 App Store 的原始 artwork，128px webp，本地打包，
// 不走任何图床（assets.coingecko.com 在国内实测 20 秒超时）。

const ICON = (id) => `/wallets/${id}.webp`;

/** 移动端才值得展示钱包墙；桌面浏览器没有注入时只能靠扩展或手机扫码 */
export function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent);
}

export function currentUrl() {
  return typeof location !== 'undefined' ? location.origin + '/' : 'https://ufo-eea.pages.dev/';
}

/**
 * 落地标记：从钱包图标跳进来时带上 #c=1。
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
 * 钱包清单。
 * `scheme: true` 表示自定义协议，需要超时回落；
 * 其余是 https universal link，App 没装会自己落到下载页。
 */
export function walletList() {
  // 落地即请求授权的地址：用户点图标的目的就是连接，不该让他进去再找按钮
  const target = autoconnectUrl();
  const bare = target.replace(/^https?:\/\//, '');
  const enc = encodeURIComponent(target);

  return [
    {
      id: 'metamask', name: 'MetaMask',
      url: `https://metamask.app.link/dapp/${bare}`,
      fallback: 'https://metamask.io/download/'
    },
    {
      id: 'trust', name: 'Trust Wallet',
      url: `https://link.trustwallet.com/open_url?coin_id=60&url=${enc}`,
      fallback: 'https://trustwallet.com/download'
    },
    {
      id: 'okx', name: 'OKX Wallet',
      url: `okx://wallet/dapp/url?dappUrl=${enc}`,
      fallback: 'https://www.okx.com/web3',
      scheme: true
    },
    {
      id: 'bitget', name: 'Bitget Wallet',
      url: `https://bkcode.vip?action=dapp&url=${enc}`,
      fallback: 'https://web3.bitget.com/'
    },
    {
      id: 'tokenpocket', name: 'TokenPocket',
      // chain 显式声明 BSC，部分版本会据此预选网络
      url: `tpdapp://open?params=${encodeURIComponent(JSON.stringify({ url: target, chain: 'BSC' }))}`,
      fallback: 'https://www.tokenpocket.pro/',
      scheme: true
    },
    {
      id: 'phantom', name: 'Phantom',
      // 官方格式：url 作为路径段整段编码，ref 是发起方地址
      url: `https://phantom.com/ul/browse/${enc}?ref=${enc}`,
      fallback: 'https://phantom.app/download'
    },
    {
      id: 'safepal', name: 'SafePal',
      url: `https://link.safepal.io/dapp?url=${enc}`,
      fallback: 'https://www.safepal.com/download'
    },
    {
      id: 'imtoken', name: 'imToken',
      url: `imtokenv2://navigate/DappView?url=${enc}`,
      fallback: 'https://token.im/download',
      scheme: true
    },
    {
      id: 'coinbase', name: 'Coinbase Wallet',
      url: `https://go.cb-w.com/dapp?cb_url=${enc}`,
      fallback: 'https://www.coinbase.com/wallet/downloads'
    },
    {
      id: 'binance', name: 'Binance Wallet',
      url: `bnc://app.binance.com/cedefi/dapp?url=${enc}`,
      fallback: 'https://www.binance.com/en/web3wallet',
      scheme: true
    }
  ].map((w) => ({ ...w, icon: ICON(w.id) }));
}

/**
 * 在钱包 App 的内置浏览器里打开本站。
 * 落地后页面里已经有 window.ethereum，注入式逻辑会自动恢复连接，
 * 用户不需要再点任何东西 —— 这正是这条路径比 WalletConnect 好的地方。
 */
export function openInWallet(wallet) {
  if (!wallet.scheme) {
    // https：装了 App 由系统接管，没装就是下载页，不需要额外判断
    location.href = wallet.url;
    return;
  }

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
