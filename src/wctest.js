// ============================================================================
// WalletConnect 实连测试（?wctest=1）
// ----------------------------------------------------------------------------
// 为什么需要它：
//   /relay 那个页面的判据是错的。它用裸 WebSocket 去连 relay，而 relay 要求
//   子协议 + JWT，裸连必然被拒 —— 我在一台完全没有网络限制的海外机器上复现
//   了同样的 non-101，说明那个失败跟封锁无关。用它去判断"中继被墙"，等于拿
//   "手没伸进去" 当成 "门锁了"。
//
//   而同一张截图里 HTTPS 到两个 relay 域名都是通的（700~870ms），OKX 的私有
//   中继握手也成功了 —— 这两条恰恰说明网络层并不封 WebSocket。
//
//   所以唯一有意义的测法，是让真正的 SDK 去连一次，看它能不能拿到配对 URI。
//   这个页面做的就是这件事，不裸连、不猜，直接读 SDK 的返回。
// ============================================================================

export function shouldRunTest() {
  try {
    return new URLSearchParams(location.search).get('wctest') === '1';
  } catch (e) {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function runWcTest(root) {
  const rows = new Map();
  root.innerHTML = '';
  root.style.cssText =
    'margin:0;padding:18px 16px 56px;background:#0b1020;color:#e6edf7;min-height:100vh;' +
    'box-sizing:border-box;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

  const h = document.createElement('h1');
  h.textContent = 'WalletConnect 实连测试';
  h.style.cssText = 'font-size:19px;margin:0 0 6px';
  root.appendChild(h);

  const sub = document.createElement('p');
  sub.textContent = '让真正的 SDK 去连一次中继，不裸连、不猜。约 30 秒。';
  sub.style.cssText = 'color:#8b9bb4;font-size:13px;margin:0 0 16px;line-height:1.6';
  root.appendChild(sub);

  function row(key, name) {
    const r = document.createElement('div');
    r.style.cssText =
      'display:flex;gap:10px;padding:11px 12px;border-radius:11px;background:#141a2e;margin-bottom:6px';
    const d = document.createElement('div');
    d.style.cssText =
      'width:9px;height:9px;border-radius:50%;background:#3a465f;margin-top:6px;flex:0 0 auto';
    const b = document.createElement('div');
    b.style.cssText = 'flex:1;min-width:0';
    const n = document.createElement('div');
    n.textContent = name;
    n.style.cssText = 'font-size:13.5px;font-weight:600;line-height:1.4';
    const m = document.createElement('div');
    m.textContent = '等待中';
    m.style.cssText = 'font-size:12px;color:#8b9bb4;margin-top:3px;word-break:break-all';
    b.appendChild(n); b.appendChild(m); r.appendChild(d); r.appendChild(b);
    root.appendChild(r);
    const o = { dot: d, meta: m, state: 'idle' };
    rows.set(key, o);
    return o;
  }

  function set(key, st, txt) {
    const o = rows.get(key);
    if (!o) return;
    o.state = st;
    o.dot.style.background = st === 'ok' ? '#22c55e' : st === 'bad' ? '#ef4444' : '#f0b429';
    o.meta.textContent = txt;
  }

  function verdict(head, body) {
    const s = document.createElement('div');
    s.style.cssText =
      'margin-top:18px;padding:14px 15px;border-radius:11px;background:#141a2e;' +
      'border-left:3px solid #3b82f6;font-size:13.5px;line-height:1.8;white-space:pre-wrap';
    s.textContent = head + '\n' + body;
    root.appendChild(s);
    s.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  (async () => {
    // 1. 下载钱包侧 SDK
    row('sdk', '加载钱包侧 SDK');
    let m;
    const t0 = performance.now();
    set('sdk', 'run', '下载中…');
    try {
      m = await import('./walletconnect');
      set('sdk', 'ok', Math.round(performance.now() - t0) + ' ms');
    } catch (e) {
      set('sdk', 'bad', String((e && e.message) || e));
      verdict('失败', 'SDK 下载不下来。这一步跟中继无关，是资源加载问题。');
      return;
    }

    if (!m.wcConfigured || !m.wcConfigured()) {
      set('sdk', 'bad', 'Project ID 未配置');
      verdict('失败', '没有 Reown Project ID，这条路根本不会启动。');
      return;
    }

    // 2. HTTPS 粗探（只作参照，不作判据）
    row('http', 'HTTPS 到 relay（参照项）');
    set('http', 'run', '探测中…');
    const t1 = performance.now();
    try {
      const r = await m.probeRelay({ force: true, timeoutMs: 8000 });
      set('http', r.ok ? 'ok' : 'bad',
        (r.ok ? '通' : '不通') + ' · ' + Math.round(performance.now() - t1) + ' ms');
    } catch (e) {
      set('http', 'bad', String((e && e.message) || e));
    }

    // 3. 让 SDK 真连一次中继
    row('init', '构造 provider（SDK 内部初始化）');
    row('uri', '中继握手并生成配对 URI');
    set('init', 'run', '初始化中…');
    set('uri', 'run', '等待中继回执…');

    const t2 = performance.now();
    let st;
    try {
      st = m.warmWc();
    } catch (e) {
      set('init', 'bad', String((e && e.message) || e));
      set('uri', 'bad', '—');
      verdict('失败', String((e && e.message) || e));
      return;
    }
    if (!st) {
      set('init', 'bad', '未启动');
      set('uri', 'bad', '—');
      verdict('失败', 'warmWc 没有返回状态对象。');
      return;
    }

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (st.error) {
        const msg = String((st.error && st.error.message) || st.error);
        set('init', 'bad', msg);
        set('uri', 'bad', '未生成');
        verdict('失败', '中继握手没完成，错误原文：\n' + msg +
          '\n\n这句话就是钱包侧 SDK 自己报的，不是我们的推断。把它原样发我，我照着改。');
        return;
      }
      // provider 构造成功只说明 SDK 跑起来了，不代表中继握手完成 ——
      // 真正的判据只有一个：URI 拿到没有。
      if (st.provider && rows.get('init').state !== 'ok') {
        set('init', 'ok', Math.round(performance.now() - t2) + ' ms');
      }
      if (st.uri) {
        set('init', 'ok', Math.round(performance.now() - t2) + ' ms');
        set('uri', 'ok', Math.round(performance.now() - t2) + ' ms · ' + st.uri.slice(0, 46) + '…');
        verdict('成功 · 中继是通的',
          'SDK 连上了中继，配对 URI 也生成了。\n\n' +
          '这意味着 WalletConnect 这条路完全可用：用户在钱包 App 里授权，' +
          '确认后按 redirect 声明自动跳回浏览器，页面不用进任何内置浏览器。\n\n' +
          '下面两个按钮可以直接验完整闭环：点了会带着这条配对 URI 跳进 App，' +
          '你在 App 里点一次「连接」，然后看它是不是自己回到浏览器。');

        // 一键验证完整闭环。必须在点击的同步栈里赋值 location.href ——
        // 挪进 await 之后 Chrome 会当成来路不明的导航丢掉。
        const apps = [
          ['用 Trust Wallet 试一次', 'https://link.trustwallet.com/wc?uri='],
          ['用 Coin98 试一次', 'coin98://wc?uri=']
        ];
        apps.forEach(([label, prefix]) => {
          const b = document.createElement('button');
          b.textContent = label;
          b.style.cssText =
            'display:block;width:100%;margin-top:10px;padding:13px 16px;border:none;' +
            'border-radius:11px;background:#3b82f6;color:#fff;font-size:14px;' +
            'font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent';
          b.onclick = () => { location.href = prefix + encodeURIComponent(st.uri); };
          root.appendChild(b);
        });
        return;
      }
      await sleep(200);
    }

    set('uri', 'bad', '30 秒内没有生成');
    // 分辨两种完全不同的超时：
    //   provider 都没构造出来 → 卡在建立长连接这一步，HTTP 能过、WebSocket 过不去
    //   provider 有了但没 URI   → 长连接建起来了，中继没回执
    // 这两种的处理方式不同，不能混成一句话。
    if (!st.provider) {
      set('init', 'bad', '30 秒未完成 · 长连接没建起来');
      verdict('超时 · 卡在长连接',
        'SDK 在「与中继建立 WebSocket」这一步卡死了 30 秒。\n\n' +
        '注意上一行：HTTPS 是通的。这说明不是域名解析、也不是 TCP/TLS 的问题，\n' +
        '而是这条连接在 443 上先从普通请求升级成 WebSocket 时被掐住了 ——\n' +
        '常见于分流代理：普通网页照常转发，长连接不转发。\n\n' +
        '你状态栏一直挂着 VPN。请关掉它，重新打开这个页面再跑一次。\n' +
        '如果关掉之后 URI 出来了，那问题从头到尾就不在代码。\n' +
        '如果关掉还是这样，那就是这条线路对 WebSocket 的定点限制，网页侧无解。');
      return;
    }
    verdict('超时 · 长连接通了但没回执', 'SDK 连上了中继，但 30 秒内没有下发配对 URI。\n\n' +
      '这种情况通常是中继侧限流或 projectId 配额问题，把这一屏发我，我去查 Reown 控制台。');
  })();
}
