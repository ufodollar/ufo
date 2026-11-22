// ============================================================================
// WalletConnect 通道
// ----------------------------------------------------------------------------
// 为什么需要它：
//   其他钱包走的是「内置浏览器」——点图标进 App 的 WebView，页面在 App 里打开，
//   连上之后用户一直留在那个 WebView 里操作。
//   OKX 走的是「中继」——页面始终在 Chrome，App 只负责确认和签名，确认完
//   自动跳回 Chrome。
//
//   如果要让所有钱包都变成后一种，连接状态就不能存在浏览器本地（WebView 的
//   localStorage 和 Chrome 互不相通，跳回去也读不到），必须存在一条双方都能
//   访问的中继通道上。WalletConnect 就是那条通道，600+ 钱包实现了它。
//
// 为什么不是「复制 OKX 的 SDK」：
//   @okxconnect 是 OKX 的私有协议，钱包类型枚举里只有 OKX_MINI / OKX_APP /
//   OKX_WALLET / OKX_APP_COMMON 四个值，别家不认。能复制的只有「独立分包 +
//   懒加载」这个构建方式，代码在这里同样照做（见动态 import）。
//
// 为什么留一个空 Project ID：
//   WalletConnect 的 relay 需要 Reown 签发的 projectId，没有它连不上中继。
//   填进下面的常量即启用；留空则钱包墙完全退回内置浏览器，行为与今天一致，
//   也不会下载这 300KB。
// ============================================================================

import { RPC_URL, WC_PROJECT_ID } from './config';
import { markWcPending, clearWcPending } from './wcpending';
import { setWcUri, clearWcUri } from './wclink';

// WalletConnect 的部分依赖（base64 编解码、签名工具）裸用 Buffer。
// 浏览器没有这个全局，SDK 一跑到编码那一步就抛 "Buffer is not defined" ——
// 而且是在 App 已经跳过去之后才炸，用户完全看不出发生了什么。
//
// 这段必须是静态 import：它只落在 walletconnect 这个按需 chunk 里，
// 没配置 Project ID 的用户一分钱都不付。
import { Buffer as BufferPolyfill } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = BufferPolyfill;
}

// BNB Smart Chain
const CHAIN_DECIMAL = 56;
const CHAIN_HEX = '0x38';

const ORIGIN = typeof location !== 'undefined' ? location.origin : 'https://ufo-eea.pages.dev';

/** 通道是否可用。UI 用它决定钱包图标走中继还是走内置浏览器。 */
export const wcConfigured = () => !!WC_PROJECT_ID;

let providerPromise = null;

/**
 * 预热状态。`uri` 一到位就同时写进 wclink.js，供点击时的同步跳转取用。
 * 整条生命周期只在本次页面会话内有效；刷新后由 localStorage 里的会话接管。
 */
let warm = null;
const WARM_TTL = 4 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProvider() {
  if (!WC_PROJECT_ID) return Promise.reject(new Error('WalletConnect is not configured.'));
  if (!providerPromise) {
    // 动态 import：没配置 projectId 的人一分钱都不用付，配置了的人也只在
    // 真的点钱包时才下载。
    providerPromise = import('@walletconnect/ethereum-provider')
      .then(async (m) => {
        const p = await m.EthereumProvider.init({
          projectId: WC_PROJECT_ID,
          chains: [CHAIN_DECIMAL],
          // 不用它自带的二维码弹窗：桌面走扩展、手机走 deeplink，
          // 这个弹窗只会和我们的钱包墙抢注意力。
          showQrModal: false,
          rpcMap: { [CHAIN_DECIMAL]: RPC_URL },
          metadata: {
            name: 'UFO Ecosystem',
            description: 'Self-service issuance for UFO Dollar on BNB Smart Chain',
            url: ORIGIN,
            icons: [ORIGIN + '/icon-512.png']
          }
        });

        // init() 会把上次的会话从 localStorage 读回来（loadPersistedSession），
        // 地址和 chainId 都能恢复 —— 但 rpcProviders 不会，那一步只有配对成功时
        // 才在 onConnect 里建。少了它，恢复出来的会话读得到地址，一发起请求就抛
        // "JSON-RPC provider for eip155 not found"，表现为「连上了但什么都干不了」。
        if (p.session) {
          try { p.signer.onConnect(); } catch (e) { /* SDK 换实现时降级为只有地址 */ }
        }
        return p;
      })
      .catch((e) => { providerPromise = null; throw e; });
  }
  return providerPromise;
}

/** 已经建好的会话，纯本地读，不发起任何网络请求 */
function snapshot(provider) {
  if (!provider || !provider.session) return null;
  const accounts = provider.accounts || [];
  if (!accounts.length) return null;
  return { accounts, provider };
}

/**
 * 用中继建立连接。
 *
 * 调用方（WalletPicker）负责在点击的同步栈里跳转 —— 这里只负责「等结果」。
 * 为什么要把这两件事拆开：
 *
 *   WalletConnect 必须先跑起 SDK、连中继、生成 pairing URI，才有东西可以跳。
 *   首次这一步要下 400KB+，耗时轻松超过 Chrome 认定的用户手势窗口（5 秒）。
 *   在异步回调里导航会被静默丢弃，表现就是「点了图标，什么都没发生」。
 *
 *   所以 URI 由 warmWc() 在钱包墙打开时就预先生成，点击时同步取走并跳转。
 *   这里收到的 launched 表示「已经跳过了」，只等会话回来。
 *
 * onUri 是兜底：预热还没完成时点了图标，URI 到位后把它交给 UI 渲染成一个
 * 真链接 —— 那时已经在异步栈里，我们自己的导航不可靠，用户再点一次最稳。
 */
export async function connectWc(wallet, { launched = false, onUri } = {}) {
  const prefix = wallet && wallet.wcPrefix;
  if (!prefix) throw new Error('This wallet has no WalletConnect entry.');

  const st = warmWc();
  if (!st) throw new Error('WalletConnect is not configured.');

  // 预热可能才刚开始（面板打开后立刻点了图标）。等它把 provider 和
  // connect() 都发起之后再往下走，否则 connectPromise 还是 null。
  await st.started;

  const provider = await loadProvider();

  const existing = snapshot(provider);
  if (existing) { clearWcPending(); clearWcUri(); warm = null; return existing; }

  markWcPending();

  if (!launched) {
    const uri = st.uri || await waitForUri(st, 15000);
    if (!uri) {
      clearWcPending();
      warm = null;
      const reason = st.error && st.error.message;
      throw new Error(reason
        ? `Could not reach the WalletConnect relay: ${reason}`
        : 'Could not reach the WalletConnect relay. Check your connection and try again.');
    }
    // 已经不在用户手势里了。把 URI 交给 UI，由用户自己点那个链接。
    // 注意这里必须无条件交出去：URI 可能是刚刚才到的（wclink 里刚有值），
    // 但点击那一刻它是空的，页面并没有跳走。
    if (onUri) onUri(uri);
  }

  const pairing = st.connectPromise;
  if (!pairing) {
    clearWcPending();
    warm = null;
    throw new Error('WalletConnect could not start.');
  }

  try {
    const result = await pairing;
    const accounts = (Array.isArray(result) && result.length ? result : provider.accounts) || [];
    clearWcPending();
    clearWcUri();
    warm = null;
    if (!accounts.length) throw new Error('The wallet approved the connection but returned no account.');
    return { accounts, provider };
  } catch (e) {
    clearWcPending();
    clearWcUri();
    warm = null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// 预热
// ---------------------------------------------------------------------------

/**
 * 提前把「SDK 就绪 + 中继握手 + 生成 pairing URI」这三步做完。
 *
 * 钱包墙一打开就调用。用户从看到九个图标到点中其中一个，通常 1~3 秒，
 * 通常够 URI 就位。这样点击时只剩一次同步跳转，落在手势窗口内。
 *
 * 同一个 URI 对任何 WalletConnect 钱包都有效 —— URI 描述的是「这一侧要发起
 * 一次配对」，不描述对方是谁。所以预热一次就够所有图标共用。
 *
 * 已经连过（本地有会话）时不发起新的配对，直接把会话记在 state 上，
 * 点图标零跳转直接进页面。
 */
export function warmWc() {
  if (!WC_PROJECT_ID) return null;
  if (warm) {
    // 已就绪、已出错、或还在寿命内：直接复用。过期就重建。
    if (warm.ready || warm.error || Date.now() - warm.since < WARM_TTL) return warm;
    // 重建前先把旧监听摘掉：provider 是复用的单例，监听器会越积越多。
    if (warm.provider && warm.onDisplay) {
      try { warm.provider.removeListener('display_uri', warm.onDisplay); } catch (e) { /* noop */ }
    }
    warm = null;
  }

  let markStarted;
  const st = {
    uri: null, since: Date.now(), provider: null, connectPromise: null,
    error: null, ready: false, listeners: [],
    // connectWc 可能在预热还没跑完时就被调用。等这个 Promise 再取 connectPromise，
    // 否则会拿到 null，被误判成「WalletConnect 起不来」。
    started: new Promise((resolve) => { markStarted = resolve; })
  };
  warm = st;

  (async () => {
    let provider;
    try {
      provider = await loadProvider();
    } catch (e) {
      if (warm === st) st.error = e;
      markStarted();
      return;
    }
    if (warm !== st) { markStarted(); return; }
    st.provider = provider;

    const existing = snapshot(provider);
    if (existing) {
      // 已经有会话：不需要新的配对，也别让上一次残留的 URI 把用户再跳一次。
      st.ready = true;
      clearWcUri();
      markStarted();
      return;
    }

    // provider 实例是复用的，监听器必须能摘掉，否则每重建一次就多一个。
    const onDisplay = (value) => {
      if (warm !== st || !value) return;
      st.uri = value;
      setWcUri(value);
      st.listeners.splice(0).forEach((fn) => { try { fn(value); } catch (e) { /* noop */ } });
    };
    st.onDisplay = onDisplay;
    provider.on('display_uri', onDisplay);

    st.connectPromise = provider.connect();
    st.connectPromise.catch((e) => {
      if (warm !== st) return;
      st.error = e;
      st.listeners.splice(0).forEach((fn) => { try { fn(null); } catch (er) { /* noop */ } });
    });
    markStarted();
  })();

  return st;
}

function waitForUri(st, ms) {
  if (st.uri) return Promise.resolve(st.uri);
  if (st.error) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = (value) => {
      clearTimeout(timer);
      st.listeners = st.listeners.filter((f) => f !== onUri);
      resolve(value || null);
    };
    const timer = setTimeout(() => done(null), ms);
    const onUri = (value) => done(value);
    st.listeners.push(onUri);
  });
}

/**
 * 同步跳转到钱包 App。
 *
 * 必须由调用方在点击的同步调用栈里调用 —— 这时候 Chrome 还认这是用户意图，
 * https 的 universal link 会被正常导航，系统再把它交给对应 App。
 * 一旦挪进 await 之后，部分浏览器会当作来路不明的导航直接丢掉。
 */
export function launchHref(href) {
  if (!href) return;
  try {
    location.href = href;
  } catch (e) { /* 少数 WebView 会把赋值抛出来，交给调用方的兜底提示 */ }
}

/** 从会话的命名空间里直接读地址，不依赖 provider 内部是否已经同步过。 */
function accountsFromSession(provider) {
  const session = provider && provider.session;
  if (!session || !session.namespaces) return [];
  const key = Object.keys(session.namespaces).find((k) => k.indexOf('eip155') === 0);
  if (!key) return [];
  const ns = session.namespaces[key];
  if (!ns || !Array.isArray(ns.accounts)) return [];
  return ns.accounts.map((a) => String(a).split(':').pop()).filter(Boolean);
}

/**
 * 把「存储里有会话」补成「provider 处于可用状态」。
 *
 * init() 只管读一次本地会话；会话如果是在那之后才落盘（App 那边刚刚确认，
 * 页面已经在加载了），provider 的 accounts / rpcProviders 都还是空的 ——
 * 这时直接用它发请求会失败。这里补上，顺手把中继上的 provider 建起来。
 */
function revive(provider) {
  const direct = snapshot(provider);
  if (direct) return direct;

  const accounts = accountsFromSession(provider);
  if (!accounts.length) return null;

  try {
    const namespaces = provider.session.namespaces;
    const key = Object.keys(namespaces).find((k) => k.indexOf('eip155') === 0);
    const caipAccounts = namespaces[key].accounts;
    provider.signer.onConnect();
    provider.setChainIds(caipAccounts);
    provider.setAccounts(caipAccounts);
  } catch (e) {
    // 补不上内部状态也能用：交易层的读操作全走公共 RPC，只有签名需要这个 provider，
    // 而签名请求到那一步会再走一次 connect 流程。
  }

  return snapshot(provider) || { accounts, provider };
}

/**
 * 回跳 / 刷新后恢复会话。
 *
 * 注意这里不调 provider.enable()：在没有会话时它内部会发起一次新的配对，
 * 把「静默恢复」变成「偷偷弹授权框」。轮询本地会话就够了。
 */
export async function restoreWc({ windowMs = 8000 } = {}) {
  let provider;
  try {
    provider = await loadProvider();
  } catch (e) {
    return null;
  }

  const deadline = Date.now() + windowMs;
  for (;;) {
    const found = revive(provider);
    if (found) return found;
    if (Date.now() >= deadline) return null;
    await sleep(300);
  }
}

/** 当前会话是否在 BSC 上。切链交给各钱包自己的确认框。 */
export async function ensureWcChain(provider) {
  if (!provider || typeof provider.request !== 'function') return false;
  try {
    const current = await provider.request({ method: 'eth_chainId' });
    if (current && String(current).toLowerCase() === CHAIN_HEX) return true;
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_HEX }]
    });
    return true;
  } catch (e) {
    return false;
  }
}

/** 空闲预热：只下代码、只建 provider，不弹任何东西 */
export function prefetchWc() {
  if (!WC_PROJECT_ID) return Promise.resolve(null);
  return loadProvider().catch(() => null);
}
