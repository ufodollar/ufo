import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    // 🚨 修复：兼容底层 Web3 库的 process.env 读取
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    // 单包在 2MB 上下（AppKit + WalletConnect 占大头），是该技术栈的常态，放宽告警阈值
    chunkSizeWarningLimit: 2500
    // 这里刻意不做 manualChunks：
    // 按 @reown / ethers / viem 分包实测，viem 被整包纳入且模块在 chunk 间重复，
    // 总体积从 1.98MB 涨到 4.58MB（gzip 570KB -> 1.27MB）。
    // 单包 + _headers 长缓存（immutable）比拆包更划算。
  }
})
