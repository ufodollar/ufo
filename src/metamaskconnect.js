// ============================================================================
// MetaMask Connect EVM 适配层
// ----------------------------------------------------------------------------
// 和 okxconnect.js 是同一类东西：不是把网址塞进钱包内置浏览器，而是在浏览器里
// 发起一条会话，App 弹「连接」，用户确认后**自动跳回本页**，页面拿到一个
// EIP-1193 provider，之后的签名由 App 完成。
//
// 为什么值得单独接这一家：
//   其余 6 个钱包没有任何对外开放的私有通道，只能靠 deeplink 打开内置浏览器
//   或走 WalletConnect（中继在部分网络被封）。MetaMask 和 Coinbase 是仅有的
//   两家提供了「外部 SDK + 自家中继」的钱包，这条路与 WalletConnect 无关。
//
// 关键约束：
//   · SDK 体积不小（multichain 那一坨），必须动态 import 成独立 chunk，
//     首屏一个字节都不带。
//   · 桌面端不需要它 —— 扩展由 EIP-6963 发现，走这条反而多一跳。
// ============================================================================

import { RPC_URL } from './config';
import { markMmPending, clearMmPending, markMmSeen } from './mmpending';

const CHAIN_DECIMAL = 56;
const CHAIN_HEX = '0x38';

const ORIGIN = typeof location !== 'undefined' ? location.origin : 'https://ufo-eea.pages.dev';

let clientPromise = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 动态加载并初始化。
 *
 * skipAutoAnnounce：我们自己维护 EIP-6963 列表（桌面端扩展），SDK 再广播一次
 * 会让同一个 MetaMask 在面板里出现两遍。
 * analytics 关掉：这是给用户用的发行页，没必要把行为数据送去第三方。
 */
function loadClient() {
  if (!clientPromise) {
    clientPromise = import('@metamask/connect-evm')
      .then((m) => m.createEVMClient({
        dapp: {
          name: 'UFO Ecosystem',
          url: ORIGIN,
          iconUrl: ORIGIN + '/icon-512.png'
        },
        api: {
          // 只声明 BSC。这个站点只会在 56 上签名，多声明一条链只会让
          // 连接页多出勾选项。
          supportedNetworks: { [CHAIN_HEX]: RPC_URL }
        },
        ui: {
          // 不要 SDK 自带的二维码弹窗：桌面端我们已经用 EIP-6963 列出扩展，
          // 手机端直接 deeplink 进 App。
          headless: true,
          showInstallModal: false
        },
        analytics: { enabled: false },
        skipAutoAnnounce: true,
        debug: false
      }))
      .catch((e) => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

/** 预热：只下代码、只 init，不建会话、不弹任何窗口 */
export function prefetchMetaMask() {
  return loadClient().catch(() => null);
}

/** 纯本地读：问一句当前有没有已授权的账户，不弹窗 */
async function readAccounts(client) {
  try {
    const provider = client.getProvider();
    const accounts = await provider.request({ method: 'eth_accounts' });
    return Array.isArray(accounts) ? accounts.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 半途标记
// ---------------------------------------------------------------------------
// 点图标 → 跳 App → 用户在 App 里确认 → 回跳。若手机在 App 里把页面回收了，
// 回到浏览器时是一次全新加载，除了这个标记没有任何线索能说明
// 「刚才有一次连接没走完」。key 与 seen 标记都在 mmpending.js，
// 与 okx / wc 两条通道完全隔离。

/**
 * 建立会话。会跳一次 App，用户确认后自动回到本页。
 * 返回 { accounts, provider }，可直接交给 useWallet.accept()。
 */
export async function connectMetaMask() {
  const client = await loadClient();

  // 标记必须在跳转之前写：页面若在 App 里被回收，只有它能说明这件事
  markMmPending();

  try {
    const res = await client.connect({ chainIds: [CHAIN_HEX] });
    const accounts = (res && res.accounts) || [];
    if (!accounts.length) {
      throw new Error('MetaMask returned no account. Please approve the connection in the app.');
    }
    clearMmPending();
    // 记住这家用过：下次打开页面才值得在空闲时把 SDK 预取下来
    markMmSeen();
    return { accounts, provider: client.getProvider(), client };
  } catch (e) {
    // 用户取消 / 明确失败：标记作废，否则以后每次打开页面都会白跑一次恢复。
    // 页面被系统回收的情形不会走到这里，标记会留下 —— 那正是我们要的。
    clearMmPending();
    throw e;
  }
}

/**
 * 回跳后 / 刷新后恢复已有会话。
 *
 * SDK 自己会把会话持久化（文档明确承诺 persists sessions across page reloads），
 * 所以这里只做一件事：给一个窗口期反复问 eth_accounts。回跳时新标签页
 * 可能比会话落盘更早就绪，第一次问必然是空的 —— 问一次就放弃是错的。
 */
export async function restoreMetaMask({ windowMs = 6000 } = {}) {
  let client;
  try {
    client = await loadClient();
  } catch (e) {
    return null;
  }

  const first = await readAccounts(client);
  if (first.length) return { accounts: first, provider: client.getProvider(), client };

  const deadline = Date.now() + windowMs;
  while (Date.now() < deadline) {
    await sleep(350);
    const accounts = await readAccounts(client);
    if (accounts.length) return { accounts, provider: client.getProvider(), client };
  }

  return null;
}
