import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 资产路径必须是绝对地址。钱包的内置浏览器用 deep link 打开页面时，
  // document.baseURI 会停留在 trust://open_url?...&url=... 这个地址上，
  // 于是 "/assets/index-x.js" 会被解析成 trust://open_url/assets/index-x.js，
  // 报 ERR_UNKNOWN_URL_SCHEME —— 脚本永远不下载，页面只剩白屏。
  // 写成完整 origin 后，解析不再依赖 baseURI，deep link 进来也能加载。
  base: 'https://ufo-eea.pages.dev/',
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // 首屏入口约 200KB；唯一的按需 chunk 是 ethers（点 Swap 才下载，约 180KB）。
    // 阈值定在 400KB：正常情况下碰不到，一旦有人把重依赖塞回主包就会立刻告警。
    chunkSizeWarningLimit: 400
  }
})
