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
