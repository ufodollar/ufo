import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

const rootEl = document.getElementById('root');

// ?wctest=1 走一条独立分支：只做一件事 —— 让真正的 WalletConnect SDK 去连一次
// 中继，把结果直接打在屏幕上。这条分支不渲染 React 应用，所以必须自己把
// 「已挂载」标志置上，否则 index.html 那个 4.5 秒兜底会把它当成白屏去刷新。
const isWcTest = /[?&]wctest=1(&|$)/.test(location.search);

if (isWcTest) {
  if (window.__ufoBoot) window.__ufoBoot.mounted = true;
  import('./wctest').then((m) => m.runWcTest(rootEl));
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // 记录「真的挂载成功」：判据是 #root 里有元素，而不是「脚本执行过了」。
  // 页面自愈兜底会读这个标志，避免把已经渲染好的页面误判成白屏。
  requestAnimationFrame(() => {
    if (window.__ufoBoot && rootEl.childElementCount > 0) window.__ufoBoot.mounted = true;
  });

  // 刷新成功就把「已自愈过一次」的标记清掉，否则下一次发布后就没法再自愈了。
  // 放在挂载之后：走到这里说明这一轮的资源全都拿得到，标记已经没有存在意义。
  requestAnimationFrame(() => {
    try {
      if (rootEl.childElementCount > 0) sessionStorage.removeItem('ufo:preload-reloaded');
    } catch (e) { /* 隐私模式下没有 sessionStorage，忽略 */ }
  });
}
