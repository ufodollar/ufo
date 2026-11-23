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
    // ★ 指定 chrome70，而不是 es2017 / es2020。
    //
    //   两个需要的特性分界线不同，这就是关键：
    //     · BigInt 字面量（10n ** 18n）→ Chrome 67 起支持
    //     · 可选链 ?. / 空值合并 ??   → Chrome 80 起支持
    //
    //   写 'es2017' 会让 esbuild 认为环境不支持 BigInt，直接报错拒绝编译
    //   （合约金额运算全用 BigInt，源码里到处是 10n ** 18n，改不动也不该改）。
    //   写 'es2020' 则相反：它认为环境支持 ?.，于是原样保留，线上 10 万处
    //   ?. 原封不动 —— 而钱包内置浏览器的 WebView 长期停在 Chrome 70–79，
    //   一解析就 SyntaxError，整个 bundle 一行不执行，页面纯白。
    //
    //   chrome70 正好落在两者之间：?. 会被降级成三元/&&，BigInt 字面量保留。
    //   这正是 Trust Wallet 白屏的根因 —— 不在 deeplink，在产物语法。
    //   之前四轮排查都在改 link 格式，方向从头就是错的：拿 Uniswap 走同一
    //   条链接也白屏，不是因为 Trust 不认这个域名，而是因为 Uniswap 的产物
    //   同样用了 ?.。
    //
    //   safari 必须 ≥14：Safari 14 才引入 BigInt，写 12 会让整个 target
    //   被拉低到「不支持 BigInt」，esbuild 直接拒绝编译。
    target: ['chrome70', 'edge79', 'safari14'],
    sourcemap: false,
    // 首屏入口约 226KB。按需 chunk 三组：
    //   ethers   —— 点 Issuance 才下载，约 62KB
    //   okx      —— 点 OKX 才下载，约 200KB（gzip）
    //   WalletConnect —— 点其他钱包才下载，最重的一组
    // 阈值定在 700KB：WalletConnect 的 core 单块就有 599KB，是它的固有体积；
    // 一旦有人把重依赖塞回主包，仍然会立刻告警。
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // OKX Connect 的一整棵依赖树（tweetnacl / crypto-js / bs58 / cross-fetch…）
            // 只有点 OKX 图标时才会用到，必须独立成块，否则会和 ethers 混在一起。
            if (/@okxconnect|tweetnacl|crypto-js|bs58|cross-fetch|uint8array-extras/.test(id)) return 'okx';
            if (/node_modules\/(ethers|@adraffy)\//.test(id)) return 'ethers';
            if (/node_modules\/@noble\//.test(id)) return 'noble';
          }
          return undefined;
        }
      }
    }
  }
})
