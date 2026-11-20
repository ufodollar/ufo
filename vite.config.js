import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    // 兼容底层 Web3 库的 process.env 读取
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  },
  build: {
    target: 'es2020',
    sourcemap: false,

    // 首屏入口约 200KB（React + 手写读链层 + UI）。
    // AppKit 与 ethers 都在动态 import 的独立 chunk 里，不参与首屏；
    // 其中最大的 AppKit chunk 约 1.1MB，属于「点了连接才会下载」，可接受。
    // 阈值定在 1300KB：既容得下这些按需 chunk，又能在入口被塞进重依赖时立刻告警。
    chunkSizeWarningLimit: 1300

    // 仍然不做 manualChunks：按需 chunk 已经由动态 import 自动生成，
    // 人为再切分会把共享模块复制进多个 chunk，总体上反而更大。
  }
})
