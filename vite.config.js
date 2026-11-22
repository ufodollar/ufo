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
    // 首屏入口约 220KB；两个按需 chunk（ethers / OKX SDK）分开命名，
    // 用户点 OKX 时只该为 OKX 那 200KB 付费，不该顺带把 ethers 也拉下来。
    // 阈值定在 400KB：正常情况下碰不到，一旦有人把重依赖塞回主包就会立刻告警。
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // OKX Connect 的一整棵依赖树（tweetnacl / crypto-js / bs58 / cross-fetch…）
            // 只有点 OKX 图标时才会用到，必须独立成块，否则会和 ethers 混在一起。
            if (/@okxconnect|tweetnacl|crypto-js|bs58|cross-fetch|uint8array-extras/.test(id)) return 'okx';
            if (/node_modules\/(ethers|@adraffy|@noble)/.test(id)) return 'ethers';
          }
          return undefined;
        }
      }
    }
  }
})
