import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

const rootEl = document.getElementById('root');

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
