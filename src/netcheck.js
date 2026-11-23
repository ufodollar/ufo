// ================= 网络自检 =================
//
// 为什么需要它：这个 DApp 能不能「点一下就回到浏览器」，完全取决于
// 手机当前网络能不能连上对应钱包的中继。这些中继在部分移动网络下被整段阻断，
// 而 SDK 对这种失败是静默重试 —— 界面停在「Preparing…」，什么也不说。
//
// ★ 第一版探测的是 `https://web3.okx.com/`，真机回传 `OKX=fail`，
//   可 OKX 通道明明跑通过四步。教训：**HTTP 探测官网首页不代表中继可用**。
//   现在每个目标都指向 SDK 里真实写死的中继地址，能用 WebSocket 就用
//   WebSocket（那才是它们实际跑的协议），HTTP 只留给只能问「域名可不可达」的。
//   一个目标可以给多个地址，任意一个通就算这条通道活着 —— 宁可放过，不要误杀。

export const NET_TARGETS = [
  {
    key: 'OKX',
    label: 'OKX Connect',
    // 来自 @okxconnect/core：wss://wsdexpri.okx.com/ws/v1/wallet-connect-relay
    // （.ac 是备用域，两个都试）
    urls: [
      { kind: 'ws', url: 'wss://wsdexpri.okx.com/ws/v1/wallet-connect-relay' },
      { kind: 'ws', url: 'wss://wsdexpri.okx.ac/ws/v1/wallet-connect-relay' }
    ]
  },
  {
    key: 'WalletConnect',
    label: 'WalletConnect relay',
    urls: [{ kind: 'ws', url: 'wss://relay.walletconnect.org' }]
  },
  {
    key: 'MetaMask',
    label: 'MetaMask SDK relay',
    // @metamask/sdk 的默认通信服务器，socket.io 长轮询入口。
    urls: [
      { kind: 'http', url: 'https://socket.api.cx.metamask.io/socket.io/?EIO=4&transport=polling' },
      { kind: 'http', url: 'https://socket.api.cx.metamask.io/' }
    ]
  },
  {
    key: 'Coinbase',
    label: 'Coinbase SDK relay',
    // RPC 走 wss 且必须带 projectId，网页侧构造不出合法的 WS 地址，
    // 所以只问「这个域名在当前网络能否建连」。
    urls: [{ kind: 'http', url: 'https://x.wallet.coinbase.com/' }]
  },
  // 对照：和本应用毫无关系、且在这个地区必然可达。
  // 它也不通说明是设备本身没网（或挂了全量代理），别去怪钱包。
  // 用百度而不是 GitHub：用户的网络在国内，GitHub 的 API 偶发不可达，
  // 拿它当基准会凭空多出一堆假警报。
  {
    key: 'control',
    label: 'control',
    urls: [
      { kind: 'http', url: 'https://www.baidu.com/' },
      { kind: 'http', url: 'https://api.github.com/' }
    ]
  }
];

async function probeHttp(url, timeoutMs) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => { try { ctl.abort(); } catch (e) { /* noop */ } }, timeoutMs);

  const run = (async () => {
    try {
      // redirect: 'manual' —— 不跟随跨域重定向。
      // follow 时若目标跳去另一个域，no-cors 下整个请求会被判失败，
      // 于是一个完全可达的域名被记成 blocked（OKX 那次假阴性也有这个因素）。
      await fetch(url, { mode: 'no-cors', cache: 'no-store', redirect: 'manual', signal: ctl.signal });
      return { ok: true, ms: Date.now() - t0, timeout: false };
    } catch (e) {
      const ms = Date.now() - t0;
      return { ok: false, ms, timeout: ms >= timeoutMs - 500 };
    }
  })();

  // abort() 不是在所有情况下都能把 fetch 立刻拽回来（no-cors + 丢包的链路
  // 尤其容易挂住，真机实测 8 秒还没退出）。UI 不能等它 —— 用 race 兜硬上限。
  const deadline = new Promise((resolve) => {
    setTimeout(() => resolve({ ok: false, ms: Date.now() - t0, timeout: true }), timeoutMs + 250);
  });

  try {
    return await Promise.race([run, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function probeWs(url, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    let settled = false;
    let ws = null;

    const done = (ok, timeout) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { if (ws) ws.close(); } catch (e) { /* noop */ }
      resolve({ ok, ms: Date.now() - t0, timeout: !!timeout });
    };

    // WS 的失败有时既没有 error 也没有 close（包被黑洞），必须有硬时限
    const timer = setTimeout(() => done(false, true), timeoutMs);

    try {
      ws = new WebSocket(url);
      ws.onopen = () => done(true, false);
      ws.onerror = () => done(false, false);
      ws.onclose = () => done(false, false);
    } catch (e) {
      done(false, false);
    }
  });
}

const probeOne = (u, timeoutMs) => (u.kind === 'ws' ? probeWs(u.url, timeoutMs) : probeHttp(u.url, timeoutMs));

/** 一个目标的多条地址并发探，任意一条通就算这条通道活着 */
async function probeTarget(t, timeoutMs) {
  const results = await Promise.all(t.urls.map((u) => probeOne(u, timeoutMs)));
  const hit = results.find((r) => r.ok);
  const timeout = results.every((r) => !r.ok && r.timeout);
  return { key: t.key, label: t.label, ok: !!hit, ms: hit ? hit.ms : results[0].ms, timeout };
}

let lastRun = null;
const TTL = 60 * 1000;

/**
 * 并发探测所有目标。
 * 返回 { rows, summary, reachable, noNetwork }：
 *   rows      —— 每个目标的明细，用于列表展示
 *   summary   —— 一行可复制/可截图的结论，如 `OKX=ok WalletConnect=fail …`
 *   reachable —— 能走「授权后自动回浏览器」这条路的渠道名数组
 */
export async function runNetcheck({ timeoutMs = 6000, force = false } = {}) {
  // 面板每开一次都重跑会白烧流量：一分钟内的结论直接复用。
  if (!force && lastRun && Date.now() - lastRun.at < TTL) return lastRun;

  const rows = await Promise.all(NET_TARGETS.map((t) => probeTarget(t, timeoutMs)));

  const byKey = {};
  rows.forEach((r) => { byKey[r.key] = r.ok; });

  const noNetwork = !byKey.control;
  const reachable = ['OKX', 'WalletConnect', 'MetaMask', 'Coinbase'].filter((k) => byKey[k]);
  const summary = rows.map((r) => `${r.key}=${r.ok ? 'ok' : 'fail'}`).join(' ');

  lastRun = { rows, summary, reachable, noNetwork, at: Date.now() };
  return lastRun;
}
