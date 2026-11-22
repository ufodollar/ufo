import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

const rootEl = document.getElementById('root');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 供 /probe 读取：真的挂载成功的标志是 #root 里有元素，而不是「脚本执行过了」
requestAnimationFrame(() => {
  if (window.__ufoBoot && rootEl.childElementCount > 0) window.__ufoBoot.mounted = true;
});
