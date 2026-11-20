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
 * 钱包清单。
 *
 * direct: true  → 能直接落进内置浏览器并加载本站
 * direct: false → 只能打开 App 本身，进去后要用户自己粘贴链接
 *
 * 目前全部是 direct:true。经过真机排查，SafePal / Binance 两个入口没有任何
 * 参数组合能加载任意 URL（官方文档已明确），OKX 的 okx:// 格式始终无公开文档
 * 且 intent 实测不可靠，Bybit 的 app.bybit.com/inapp 其官方适配器自己注明
 * 「只打开 App，不加载页面」。宁可少一个图标，也不要留下点了没反应的入口。
 */
export function walletList() {
  // 落地即请求授权的地址：用户点图标的目的就是连接，不该让他进去再找按钮
  const target = autoconnectUrl();
  const bare = target.replace(/^https?:\/\//, '');
  const enc = encodeURIComponent(target);

  // Bitget 要在 dapp 链接上追加 _needChain 才会预选网络，否则进 App 后
  // 先弹一层「选择网络」让用户手点。官方文档 Switch Network 一节：
  //   BSC → {DAppLink}?_needChain=bnb
  //
  // 注意它是 `?` 紧跟参数，不是 `&` 追加。Bitget 是按字面量匹配
  // `?_needChain=` 的，写成 `?c=1&_needChain=bnb` 匹配不上，参数被忽略，
  // 弹窗照旧 —— 这正是第一版没生效的原因。所以这里让 _needChain 打头。
  const bitgetTarget = `${currentUrl()}?_needChain=bnb&${AUTOCONNECT_PARAM}=1`;
  const encBitget = encodeURIComponent(bitgetTarget);

  return [
    {
      id: 'metamask', name: 'MetaMask', direct: true,
      // Branch 通用链接。文档现在主推 link.metamask.io/dapp/…，但 app.link
      // 这条在真机上验证过可用，没有理由冒险换。
      url: `https://metamask.app.link/dapp/${bare}`,
      fallback: 'https://metamask.io/download/'
    },
    {
      id: 'trust', name: 'Trust Wallet', direct: true,
      // coin_id 走 SLIP-44：60 是 Ethereum，714 才是 BNB。之前用 60 进站后
      // 还要手动切到 BSC，改成 714 让钱包进来就停在 BNB Chain。
      url: `https://link.trustwallet.com/open_url?coin_id=714&url=${enc}`,
      fallback: 'https://trustwallet.com/download'
    },
    {
      id: 'coinbase', name: 'Coinbase Wallet', direct: true,
      // cb_url 是 Wallet SDK 时代的格式，cdp 文档站已撤下对应页面，但社区
      // 仍在用、2026 年仍能落进内置浏览器。这一条待真机确认，若落到下载页
      // 就改成 direct:false 走复制兜底。
      url: `https://go.cb-w.com/dapp?cb_url=${enc}`,
      fallback: 'https://www.coinbase.com/wallet/downloads'
    },
    {
      id: 'bitget', name: 'Bitget Wallet', direct: true,
      // 真机验证（Android / BitKeep 9.70.1，2026-11-20）：只有纯 scheme 能进。
      // https://bkcode.vip?action=dapp&url= 是 Branch 中转，未收录站点不被解析，
      // 直接落下载页；换成 scheme 后一次即通，落地链已是 BNB Smart Chain。
      url: `bitkeep://bkconnect?action=dapp&url=${encBitget}&version=1`,
      fallback: 'https://web3.bitget.com/',
      scheme: true
    },
    {
      id: 'phantom', name: 'Phantom', direct: true,
      // 官方格式：url 作为路径段整段编码，ref 是发起方地址
      url: `https://phantom.com/ul/browse/${enc}?ref=${enc}`,
      fallback: 'https://phantom.app/download'
    },
    {
      id: 'tokenpocket', name: 'TokenPocket', direct: true,
      // chain 显式声明 BSC，部分版本会据此预选网络
      url: `tpdapp://open?params=${encodeURIComponent(JSON.stringify({ url: target, chain: 'BSC' }))}`,
      fallback: 'https://www.tokenpocket.pro/',
      scheme: true
    },
    {
      id: 'imtoken', name: 'imToken', direct: true,
      url: `imtokenv2://navigate/DappView?url=${enc}`,
      fallback: 'https://token.im/download',
      scheme: true
    },
    {
      id: 'coin98', name: 'Coin98', direct: true,
      // 官方文档（docs.coin98.com/developer-guide/deeplink）给的是 https 路径，
      // 不是 scheme：
      //   https://coin98.com/dapp/:link/:chainId
      // 之前用第三方资料里的 coin98://browser?url= 是错的 —— App 被拉起来，
      // 但停在首页，不会加载页面，和 SafePal 的表现一样。
      //
      // :link 不带协议头（官方示例是 uniswap.com），钱包自己补 https://；
      // ?c=1 必须一起编码进这一段，否则会被当成 coin98.com 自己的 query 丢掉。
      // 56 = BNB Smart Chain 的 chainId，钱包据此预选网络。
      url: `https://coin98.com/dapp/${encodeURIComponent(bare)}/56`,
      fallback: 'https://coin98.com/'
    },
    {
      id: 'onto', name: 'ONTO', direct: true,
      // 官方文档 docs.onto.app/deep-link：chain 必填、可多值，url 必填。
      // 是少数把「打开任意 URL」写进文档的钱包，和 TokenPocket / imToken 同一类。
      url: `https://link.onto.app/open_url?chain=bsc&url=${enc}`,
      fallback: 'https://onto.app/download'
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
