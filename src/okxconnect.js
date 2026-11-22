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
// ============================================================================

import { RPC_URL } from './config';

// BSC 主网。只申请这一条链：申请多链会让 App 的连接页多出勾选项，
// 而这个站点只会在 BSC 上签名。
const CHAIN = 'eip155:56';
const CHAIN_DECIMAL = '56';
const CHAIN_HEX = '0x38';

const ORIGIN = typeof location !== 'undefined' ? location.origin : 'https://ufo-eea.pages.dev';

let sdkPromise = null;

/** 动态加载 SDK。首屏不下载：只有用户真的点了 OKX 图标时才拉这 60~100KB。 */
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

/**
 * 建立会话。会跳一次 App：用户在那里点「连接」，确认后自动回到本页。
 * 返回 { accounts, provider }，provider 可直接交给 useWallet.accept()。
 */
export async function connectOkx() {
  const okx = await loadSdk();

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
      // 签名完成后的回跳地址。带上 okx=1，页面据此知道「这是在恢复 okx 会话」，
      // 从而只在这一种情况下才去加载 SDK 检查会话状态 —— 首屏不加载。
      redirect: ORIGIN + '/?okx=1'
    }
  });

  const raw = (session && session.namespaces && session.namespaces.eip155
    && session.namespaces.eip155.accounts) || [];
  const accounts = raw.map(toAddress).filter(Boolean);

  if (!accounts.length) {
    throw new Error('OKX returned no account. Please approve the connection in the app.');
  }

  return { accounts, provider: wrap(okx), session };
}

/** 已建立的会话是否还在（用户刷新页面后用来静默恢复） */
export async function restoreOkx() {
  const okx = await loadSdk();
  if (!okx.connected || !okx.connected()) return null;
  try {
    const res = await okx.request({ method: 'eth_accounts' }, CHAIN);
    const accounts = (Array.isArray(res) ? res : [res]).map(toAddress).filter(Boolean);
    if (!accounts.length) return null;
    return { accounts, provider: wrap(okx) };
  } catch (e) {
    return null;
  }
}
