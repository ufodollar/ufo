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

  // 纯主机名，无协议、无尾斜杠。Coin98 的 :link 段要求这个形态，
  // 而且它不解码 —— 见下面 coin98 的注释。
  const host = bare.replace(/[?#].*$/, '').replace(/\/$/, '');

  // Bitget 要在 dapp 链接上追加 _needChain 才会预选网络，否则进 App 后
  // 先弹一层「选择网络」让用户手点。官方文档 Switch Network 一节：
  //   BSC → {DAppLink}?_needChain=bnb
  //
  // 注意它是 `?` 紧跟参数，不是 `&` 追加。Bitget 是按字面量匹配
  // `?_needChain=` 的，写成 `?c=1&_needChain=bnb` 匹配不上，参数被忽略，
  // 弹窗照旧 —— 这正是第一版没生效的原因。所以这里让 _needChain 打头。
  const bitgetTarget = `${currentUrl()}?_needChain=bnb&${AUTOCONNECT_PARAM}=1`;
  const encBitget = encodeURIComponent(bitgetTarget);

  // Trust 无法用 deep link 带 URL 进站（见该条目注释），改为复制 + 粘贴，
  // 因此这里不再需要单独拼它的落地地址 —— target 就是 autoconnectUrl()。

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
      // 四次真机排查的最终结论（Android，2026-11-22）：
      //   1. https://link.trustwallet.com/open_url —— 落地页中转，参数丢失，停首页
      //   2. trust:// + encodeURIComponent(url) —— 浏览器打开，白屏
      //   3. intent:// + package —— 部分 ROM 被拦，点了没反应
      //   4. trust:// + 裸 url（官方文档形态，coin_id 60/714/20000714 全试）
      //      —— 浏览器都打开了，但一律白屏
      //
      // 决定性对照：用 app.uniswap.org 走同一条链接，同样白屏。所以不是
      // 我们的域名、不是参数编码、不是链 ID —— 是这个 build 收到 open_url
      // 后只切到浏览器面板，不消费 url。参数层面到此为止。
      //
      // 退化为可用的路径：direct:false —— 点击时把链接写进剪贴板，再拉起
      // App，用户在地址栏粘贴一次。浏览器已经会打开，只差一次粘贴。
      id: 'trust', name: 'Trust Wallet', direct: false, manual: true,
      url: 'trust://',
      fallback: 'https://trustwallet.com/download',
      scheme: true,
      pasteHint: 'Link copied. In Trust Wallet, tap the address bar and paste.',
      noBrowser: platform() === 'ios'
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
      // 文档只写了「在 url 上追加 _needChain」，但三种位置真机都还弹选网面板：
      //   1. ?c=1&_needChain=bnb    → 匹配不上，忽略
      //   2. ?_needChain=bnb&c=1    → 打头也不认
      //   3. 现在：内层保留，同时把 chain / _needChain 提到 deeplink 顶层
      // 说明这个参数大概只对已在 Bitget DApp 库里的站点生效 —— 未收录的域名
      // 它仍要问用户一次。真正的解法是 DApp Listing 收录，参数层面到此为止。
      url: `bitkeep://bkconnect?action=dapp&url=${encBitget}&chain=bnb&_needChain=bnb&version=1`,
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
      // 官方文档（docs.coin98.com/developer-guide/deeplink）给的是 https 路径：
      //   https://coin98.com/dapp/:link/:chainId
      //
      // 两次真机排错得到的结论：
      //   1. coin98://browser?url= 是第三方资料的错误格式 —— App 被拉起但停在首页
      //   2. :link 段会被【原样拼接】，App 不做 URL 解码。之前传
      //      ufo-eea.pages.dev%2F%3Fc%3D1，内置浏览器地址栏里显示的就是这串
      //      字面量，DNS 解析不出来，页面一直转圈。
      //
      // 所以这一条只能放裸主机名，任何编码都会坏。代价是带不进 ?c=1，
      // 自动授权改由 useWallet 里「移动端有注入就自动请求」兜住。
      // 56 = BNB Smart Chain 的 chainId，钱包据此预选网络。
      url: `https://coin98.com/dapp/${host}/56`,
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

  // 只能拉起 App、不能自带 URL 的类型（Trust）：直接跳，不设兜底计时。
  // 否则 1.8 秒后会把已经进 App 的用户甩到下载站。
  if (wallet.manual) { location.href = wallet.url; return; }

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
