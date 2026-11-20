// ============================================================================
// 钱包层：注入式优先，AppKit 按需加载
// ----------------------------------------------------------------------------
// 首屏体积的全部秘密都在这里。
//
// 之前是在模块顶层 `import { createAppKit } from '@reown/appkit/react'`，
// 于是每个访客（哪怕只是想看一眼汇率）都必须先下载并执行 1.9MB 的
// AppKit + WalletConnect + viem 全家桶，然后页面才可能亮起来。
// 移动端解析这 1.9MB 要 2-4 秒，这就是「感觉变慢了」的全部原因。
//
// 现在的策略：
//   1. 页面里有钱包注入（钱包 App 内置浏览器、装了扩展的桌面 Chrome）→
//      直接走 EIP-1193，零下载、零依赖、几十毫秒连上；
//   2. 页面里没有注入（普通手机浏览器）→ 用户点「Connect」时才去下载
//      AppKit 的那个 chunk，用完即弃，不影响首屏；
//   3. 首屏渲染完成后空闲时做一次预取，用户真去点的时候通常已在缓存里。
//
// 这样首屏 JS 从 1.95MB(gzip 576KB) 降到 300KB 量级(gzip ~100KB)，
// 而功能一个不少。
// ============================================================================

const PROJECT_ID = 'd6431212399f6c487b364387859983ea';
const APP_URL = 'https://ufo-eea.pages.dev';

// 用户成功用 WalletConnect 连过一次，就记下来。
// 下次访问即便没注入钱包，也要把 AppKit 拉起来恢复会话，否则刷新即掉线。
export const WC_MARK_KEY = 'ufo_wc_used';

let booting = null;
let modal = null;

/** 预连接：只在真要加载 AppKit 时才做，首屏不做（省 3 次 TLS 握手） */
function warmup() {
  for (const href of ['https://api.web3modal.org', 'https://relay.walletconnect.org']) {
    if (document.querySelector('link[rel="preconnect"][href="' + href + '"]')) continue;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    link.crossOrigin = '';
    document.head.appendChild(link);
  }
}

/**
 * 阻断 AppKit 的强制遥测。
 * INITIALIZE / CONNECT_SUCCESS 在 AppKit 里属于 MANDATORY_EVENTS，
 * features.analytics:false 对它们无效；批量上报走 navigator.sendBeacon，
 * 单次上报走 fetch，所以两条通道都要短路。
 */
function blockTelemetry() {
  if (window.__ufoTelemetryBlocked) return;
  window.__ufoTelemetryBlocked = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('pulse.walletconnect.org') !== -1) {
      return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return nativeFetch(input, init);
  };

  const nativeBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (nativeBeacon) {
    navigator.sendBeacon = function (url, data) {
      if (String(url).indexOf('pulse.walletconnect.org') !== -1) return true;
      return nativeBeacon(url, data);
    };
  }

  // 只吞掉钱包/中继类的 rejection，真正的代码 bug 仍然要在控制台可见
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = String((reason && (reason.message || reason)) || '');
    if (/walletconnect|reown|appkit|relay\.walletconnect|WebSocket/i.test(msg)) {
      e.preventDefault();
      console.warn('[ufo] suppressed:', msg);
    }
  });
}

export function getModal() {
  return modal;
}

/** 幂等：并发调用只会真正初始化一次 */
export function ensureAppKit() {
  if (modal) return Promise.resolve(modal);
  if (booting) return booting;

  booting = (async () => {
    blockTelemetry();
    warmup();

    const [{ createAppKit }, { EthersAdapter }, { bsc }] = await Promise.all([
      import('@reown/appkit/react'),
      import('@reown/appkit-adapter-ethers'),
      import('@reown/appkit/networks')
    ]);

    modal = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [bsc],
      metadata: {
        name: 'UFO Dollar',
        description: 'Value-Invisible Settlement Stablecoin',
        url: typeof window !== 'undefined' ? window.location.origin : APP_URL,
        icons: [APP_URL + '/icon-512.png'],
        redirect: { native: APP_URL, universal: APP_URL, linkMode: true }
      },
      projectId: PROJECT_ID,
      features: { analytics: false, allWallets: { showWallets: true } },
      featuredWalletIds: ['a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393'],
      enableWalletConnect: true,
      enableInjected: true
    });

    return modal;
  })().catch((err) => {
    // 下载失败（比如刚好断网）要允许下次重试，不能永久卡在 rejected 状态
    booting = null;
    throw err;
  });

  return booting;
}

/** 首屏渲染完之后空闲时预取，不参与首屏关键路径 */
export function prefetchAppKit() {
  const run = () => { ensureAppKit().catch(() => {}); };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 3000);
  }
}
