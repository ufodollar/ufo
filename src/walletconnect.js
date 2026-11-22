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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadProvider() {
  if (!WC_PROJECT_ID) return Promise.reject(new Error('WalletConnect is not configured.'));
  if (!providerPromise) {
    // 动态 import：没配置 projectId 的人一分钱都不用付，配置了的人也只在
    // 真的点钱包时才下载。
    providerPromise = import('@walletconnect/ethereum-provider')
      .then((m) => m.EthereumProvider.init({
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
      }))
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
 * 流程：SDK 生成配对 URI → 我们立刻把它交给钱包 App 的 deeplink →
 * 用户在 App 里点确认 → 会话建立 → 本页 resolve（如果页面还在），
 * 或者用户回到本页时由 restoreWc 接上（如果页面被系统回收了）。
 *
 * 这里必须监听 display_uri 而不是等 connect() 返回：URI 是本地生成的，
 * 拿到就要跳，等 connect() 的话页面会一直停在那里，用户什么也看不到。
 */
export async function connectWc(wallet) {
  const provider = await loadProvider();

  // 重复点击 / 刷新后还有会话：直接复用，不再走一遍授权
  const existing = snapshot(provider);
  if (existing) return existing;

  const prefix = wallet && wallet.wcPrefix;
  if (!prefix) throw new Error('This wallet has no WalletConnect entry.');

  markWcPending();

  let launched = false;
  let uriSeen = false;
  const onUri = (uri) => {
    if (!uri || launched) return;
    launched = true;
    uriSeen = true;
    launch(`${prefix}${encodeURIComponent(uri)}`);
  };

  try { provider.on('display_uri', onUri); } catch (e) { /* 老版本没有该事件 */ }

  try {
    const accounts = await provider.connect();
    clearWcPending();
    return { accounts, provider };
  } catch (e) {
    clearWcPending();
    if (!uriSeen) {
      // 连 URI 都没拿到，说明是 relay / projectId 层面的问题，得说清楚，
      // 否则用户只会看到「点了没反应」。
      throw new Error(e && e.message ? e.message : 'WalletConnect could not start.');
    }
    throw e;
  } finally {
    try { provider.removeListener('display_uri', onUri); } catch (e) { /* noop */ }
  }
}

/**
 * 跳到钱包 App。
 *
 * 用临时 <a> 点击而不是 location.href：Chrome 对异步回调里的 location 跳转
 * 拦截得更凶，a.click() 至少能在部分版本上通过。仍然不能保证 —— 所以调用方
 * 要配合 visibilitychange 判断到底走没走（见 WalletPicker）。
 */
function launch(href) {
  try {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); } catch (e) {} }, 1000);
  } catch (e) {
    try { location.href = href; } catch (err) { /* 走到这里只能让用户手动打开 */ }
  }
}

/**
 * 回跳 / 刷新后恢复会话。
 *
 * 两种情况：
 *   1. 页面活着：connect() 那笔 Promise 会自己 resolve，这个函数基本立刻命中；
 *   2. 页面被系统回收、重新加载：SDK init 时会把会话从 localStorage 读回来，
 *      但账户要 enable() 之后才填进 provider.accounts。
 *
 * 和有 OKX 那边一样，不能问一次就放弃：会话落盘和页面加载之间有一两秒的差。
 */
export async function restoreWc({ windowMs = 8000 } = {}) {
  let provider;
  try {
    provider = await loadProvider();
  } catch (e) {
    return null;
  }

  const first = snapshot(provider);
  if (first) return first;

  if (provider.session) {
    try { await provider.enable(); } catch (e) { /* 会话失效，下面继续等 */ }
    const again = snapshot(provider);
    if (again) return again;
  }

  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    await sleep(300);

    if (!provider.session) {
      // init 之后才落盘的会话：SDK 自己会在下一轮 storage 事件里捡起来，
      // 这里只负责重新 enable 一次把它读进 accounts。
      try { await provider.enable(); } catch (e) { /* 还没有会话，下一轮再看 */ }
    }

    const found = snapshot(provider);
    if (found) return found;
  }
  return null;
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
