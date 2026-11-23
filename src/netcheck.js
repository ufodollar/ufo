// ================= 网络自检 =================
//
// 为什么需要它：这个 DApp 能不能「点一下就回到浏览器」，完全取决于
// 手机当前网络能不能连上对应钱包的中继域名。
//
//   OKX          → web3.okx.com              （私有中继，OKX App 自带）
//   WalletConnect→ relay.walletconnect.org   （8 个钱包共用的公共中继）
//   MetaMask     → socket.api.cx.metamask.io （若接 @metamask/sdk）
//   Coinbase     → x.wallet.coinbase.com     （若接 @coinbase/wallet-sdk）
//
// 这些域名在部分移动网络下是被整段阻断的。阻断的表现是「静默失败」——
// SDK 只会不停重试，界面停在「Preparing…」，什么也不说。所以先花五个
// HTTP 请求问清楚：哪条通道在这个网络上活着。
//
// 用 no-cors：不校验 CORS，只要 TCP+TLS 建起来就 resolve（哪怕返回 426/404），
// 于是能把「网络层不通」和「服务端拒绝」分开 —— 后者对连接没有影响。

export const NET_TARGETS = [
  { key: 'OKX', label: 'OKX Connect', url: 'https://web3.okx.com/' },
  { key: 'WalletConnect', label: 'WalletConnect relay', url: 'https://relay.walletconnect.org/' },
  { key: 'MetaMask', label: 'MetaMask SDK relay', url: 'https://socket.api.cx.metamask.io/' },
  { key: 'Coinbase', label: 'Coinbase SDK relay', url: 'https://x.wallet.coinbase.com/' },
  // 对照：一个和本应用毫无关系、且全球可达的域名。
  // 它也不通，说明是设备本身没网 / 走了一个全量代理，别去怪钱包。
  { key: 'control', label: 'control', url: 'https://api.github.com/' }
];

async function probeOne(url, timeoutMs) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => { try { ctl.abort(); } catch (e) { /* noop */ } }, timeoutMs);

  const run = (async () => {
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-store', redirect: 'follow', signal: ctl.signal });
      return { ok: true, ms: Date.now() - t0, timeout: false };
    } catch (e) {
      const ms = Date.now() - t0;
      // 明显早于超时就失败 = 连接被拒/被重置；贴着超时线 = 黑洞，包被丢弃
      return { ok: false, ms, timeout: ms >= timeoutMs - 500 };
    }
  })();

  // abort() 不是在所有情况下都能把 fetch 立刻拽回来（no-cors + 被丢包的链路
  // 尤其容易挂住，真机实测 8 秒还没退出）。UI 不能等它 —— 用 race 兜一个硬上限，
  // 到点就先给结论，那个请求自己在后台烂掉无所谓。
  const deadline = new Promise((resolve) => {
    setTimeout(() => resolve({ ok: false, ms: Date.now() - t0, timeout: true }), timeoutMs + 250);
  });

  try {
    return await Promise.race([run, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 并发探测所有目标。
 * 返回 { rows, summary, reachable }：
 *   rows      —— 每个目标的明细，用于列表展示
 *   summary   —— 一行可复制/可截图的结论，如 `OKX=ok WalletConnect=fail …`
 *   reachable —— 能走「授权后自动回浏览器」这条路的渠道名数组
 */
let lastRun = null;
const TTL = 60 * 1000;

export async function runNetcheck({ timeoutMs = 6000, force = false } = {}) {
  // 面板每开一次都重跑会白烧流量：一分钟内的结论直接复用。
  if (!force && lastRun && Date.now() - lastRun.at < TTL) return lastRun;

  const rows = await Promise.all(
    NET_TARGETS.map(async (t) => ({ ...t, ...(await probeOne(t.url, timeoutMs)) }))
  );

  const byKey = {};
  rows.forEach((r) => { byKey[r.key] = r.ok; });

  const noNetwork = !byKey.control;
  const reachable = ['OKX', 'WalletConnect', 'MetaMask', 'Coinbase'].filter((k) => byKey[k]);
  const summary = rows.map((r) => `${r.key}=${r.ok ? 'ok' : 'fail'}`).join(' ');

  lastRun = { rows, summary, reachable, noNetwork, at: Date.now() };
  return lastRun;
}
