// ============================================================================
// OKX Connect 适配层
// ----------------------------------------------------------------------------
// 为什么不用 deep link 把网址塞进 OKX 内置浏览器：
//   真机实测（Android / OKX 6.197.0）确认了三件事——
//     1. okx:// 这一层是通的，系统会弹「继续访问 OKX Wallet？」并拉起 App
//     2. 但 App 冷启动后停在资产首页，dapp/open 的 url 参数没有被消费
//     3. 官方 SDK @okxconnect/core 里 `okx://web3/dapp/open` 是注释状态，
//        说明「打开任意网址」从来不是它开放的能力
//   也就是说，网页侧无论怎么拼都到不了内置浏览器。这不是参数没调对。
//
// 改用官方唯一支持的外部唤起协议 OKX Connect：
//   浏览器里发起会话 → App 弹「连接」确认（不是首页）→ 用户确认 →
//   自动跳回网页 → 页面拿到一个 EIP-1193 provider，
//   发交易、切链全部由它转交给 App 签名。
//
// 关键约束（决定了 tx.js 为什么要把读和写拆开）：
//   OKX Connect 只代理「签名类」方法，eth_call / eth_getBalance /
//   eth_getTransactionReceipt 一律不支持。只读一律走 chain.js 的公共 RPC。
//
// 速度上有两个天然的等待点，都在这里处理：
//   A. 点图标 → App 切过去，中间要下 SDK（约 600KB）+ 建 WS 会话。
//      → 页面空闲时就把 SDK 下好、provider 建好（prefetchOkx），
//        用户点下去只剩一次 WS 握手。
//   B. App 确认 → 回跳 → 页面显示已连接，中间要等会话落到 localStorage。
//      → restoreOkx() 不再「问一次就放弃」，而是在窗口期内反复重读，
//        旧标签页把会话写进存储的那一刻就接上。
// ============================================================================

import { RPC_URL } from './config';
import { markOkxPending, clearOkxPending } from './okxpending';

// BSC 主网。只申请这一条链：申请多链会让 App 的连接页多出勾选项，
// 而这个站点只会在 BSC 上签名。
const CHAIN = 'eip155:56';
const CHAIN_DECIMAL = '56';
const CHAIN_HEX = '0x38';

const ORIGIN = typeof location !== 'undefined' ? location.origin : 'https://ufo-eea.pages.dev';

let sdkPromise = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 动态加载 SDK。首屏不下载：只有用户真的点了 OKX 图标时才拉这一块。 */
function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import('@okxconnect/universal-provider')
      .then((m) => m.OKXUniversalProvider.init({
        dappMetaData: {
          name: 'UFO Ecosystem',
          // OKX 要求 PNG/ICO，SVG 和 webp 都不认。
          icon: ORIGIN + '/wallets/okx-180.png'
        }
      }))
      .catch((e) => { sdkPromise = null; throw e; });
  }
  return sdkPromise;
}

/**
 * 预热：只下代码、只建 provider，不弹任何东西、不建 WS 会话。
 *
 * 这是「点图标 3 秒才切进 App」的主要成因 —— 那 3 秒里有一大半是在
 * 移动网络上下 600KB 的 SDK。页面空闲时先把它拿下来，用户点下去时
 * 只剩一次 WebSocket 握手。
 *
 * 失败静默：预热是纯优化，任何异常都不该影响页面。
 */
export function prefetchOkx() {
  return loadSdk().catch(() => null);
}

/** CAIP-10（eip155:56:0xabc…）或裸地址 → 0x 开头的小写地址 */
function toAddress(item) {
  const parts = String(item || '').split(':');
  const addr = parts[parts.length - 1];
  return /^0x[0-9a-fA-F]{40}$/.test(addr) ? addr : '';
}

/**
 * 把 OKXUniversalProvider 包成 EIP-1193。
 * ethers 的 BrowserProvider 只要求 request()，useWallet 额外用到 on/removeListener。
 */
function wrap(okx) {
  const listeners = new Map();

  const emit = (event, payload) => {
    const set = listeners.get(event);
    if (!set) return;
    set.forEach((fn) => { try { fn(payload); } catch (e) { /* 单个监听器异常不影响其它 */ } });
  };

  // SDK 自己的事件透传。字段形态和 EIP-1193 不完全一致，做一次归一。
  try {
    if (typeof okx.on === 'function') {
      okx.on('accountsChanged', (accs) => {
        emit('accountsChanged', (accs || []).map(toAddress).filter(Boolean));
      });
      okx.on('disconnect', () => emit('disconnect', { code: 4900 }));
    }
  } catch (e) { /* 旧版本 SDK 没有事件，静默降级 */ }

  return {
    // 给 tx.js / 调试用的标记：只读必须绕开这个 provider
    isOkxConnect: true,

    async request({ method, params }) {
      switch (method) {
        case 'eth_chainId':
          // SDK 返回的是十进制 number，EIP-1193 和 ethers 都按 hex 解析
          return CHAIN_HEX;

        case 'net_version':
          return CHAIN_DECIMAL;

        case 'eth_accounts':
        case 'eth_requestAccounts': {
          const res = await okx.request({ method }, CHAIN);
          const list = (Array.isArray(res) ? res : [res]).map(toAddress).filter(Boolean);
          return list;
        }

        case 'wallet_switchEthereumChain': {
          // 会话只申请了 BSC。切到别的链会直接失败，不如明确告诉调用方。
          const want = params && params[0] && params[0].chainId;
          if (want && String(want).toLowerCase() !== CHAIN_HEX) {
            const err = new Error('Only BNB Smart Chain is available in this session.');
            err.code = 4902;
            throw err;
          }
          return null;
        }

        default:
          // eth_sendTransaction / personal_sign / eth_signTypedData_v4
          // 等签名类方法交给 App。
          return okx.request({ method, params }, CHAIN);
      }
    },

    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },

    removeListener(event, fn) {
      const set = listeners.get(event);
      if (set) set.delete(fn);
    }
  };
}

/** 会话里已经带回来的账户。不发起任何网络请求，纯本地读。 */
function accountsFromSession(okx) {
  const ns = okx && okx.session && okx.session.namespaces && okx.session.namespaces.eip155;
  const list = (ns && ns.accounts) || [];
  return list.map(toAddress).filter(Boolean);
}

/**
 * 建立会话。会跳一次 App：用户在那里点「连接」，确认后自动回到本页。
 * 返回 { accounts, provider }，provider 可直接交给 useWallet.accept()。
 */
export async function connectOkx() {
  const okx = await loadSdk();

  // 标记要在跳转之前写下：万一页面在 App 里被系统回收，回来时
  // 只剩这个标记能说明「刚才有一次连接没走完」。
  markOkxPending();

  try {
    const session = await okx.connect({
      namespaces: {
        eip155: {
          chains: [CHAIN],
          defaultChain: CHAIN_DECIMAL,
          // 让 SDK 在需要时能自己读链（它内部做 gas 估算时会用到）
          rpcMap: { [CHAIN_DECIMAL]: RPC_URL }
        }
      },
      sessionConfig: {
        // 回跳地址带 okx=1：页面据此知道「这是在恢复 okx 会话」。
        // 不带参数、指望 Chrome 复用原标签是更快的路径，但一旦 App 回跳时
        // 页面被系统回收，那笔 connect() 的 Promise 就永远悬着，用户回来看到的是
        // 「未连接」。宁可多一次整页加载，也不要出现这种无法自愈的状态。
        redirect: ORIGIN + '/?okx=1'
      }
    });

    const raw = (session && session.namespaces && session.namespaces.eip155
      && session.namespaces.eip155.accounts) || [];
    const accounts = raw.map(toAddress).filter(Boolean);

    if (!accounts.length) {
      throw new Error('OKX returned no account. Please approve the connection in the app.');
    }

    clearOkxPending();
    return { accounts, provider: wrap(okx), session };
  } catch (e) {
    // 用户取消 / 明确失败：标记作废，否则以后每次打开页面都会白跑一次恢复。
    // 注意页面被杀的情况不会走到这里，标记会留下 —— 那正是我们想要的。
    clearOkxPending();
    throw e;
  }
}

/**
 * 已建立的会话是否还在（回跳后 / 刷新后用来恢复）。
 *
 * 这里不能「问一次就放弃」：回跳分两种情形，
 *   - 切回原来的标签：SDK 收到 App 的响应，把会话写进 localStorage；
 *   - 新开了标签：页面比会话先就绪，第一次读存储必然是空的。
 * 后者的时间差在一两秒量级（旧标签页要先把会话落盘），所以给一个窗口期，
 * 每 300ms 重读一次存储，读到就立刻返回 —— 用户看到的等待从「几秒」变成
 * 「最多几百毫秒」。
 *
 * 会话一旦存在于 okx.session，说明 SDK 的 restoreconnect 已经成功，
 * 直接读账户，不再向 App 发 eth_accounts 往返（那是又要等一轮的）。
 */
export async function restoreOkx({ windowMs = 8000 } = {}) {
  let okx;
  try {
    okx = await loadSdk();
  } catch (e) {
    return null;
  }

  const hit = () => {
    const accounts = accountsFromSession(okx);
    if (!accounts.length) return null;
    // SDK 恢复会话分两步：先把 session 挂上，再建链 provider。
    // 只认 provider 已经建好的状态，否则会报出一条还没通的连接。
    const providers = okx.rpcProviders;
    if (providers && !providers.eip155) return null;
    return { accounts, provider: wrap(okx), session: okx.session };
  };

  // 快路径：SDK init() 内部已经恢复好了（刷新页面时走这里，零额外等待）
  const first = hit();
  if (first) return first;

  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    await sleep(300);

    // 只有在「本页还没有会话」时才让 SDK 重读存储。
    // 会话已经存在时不要再碰 tryToReconnect：它会 disconnect 重连，
    // 把一条本来正常的连接打断。
    if (!okx.session && typeof okx.tryToReconnect === 'function') {
      try { await okx.tryToReconnect(); } catch (e) { /* 存储里还没有，下一轮再看 */ }
    }

    const found = hit();
    if (found) return found;
  }

  return null;
}
