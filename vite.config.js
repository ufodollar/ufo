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
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 把体积最大的两个依赖拆成独立文件：
        // 1) 浏览器可以并行下载（走 modulepreload）
        // 2) 以后只改业务代码时，用户不必重新下载这几百 KB 的第三方库
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@reown') || id.includes('walletconnect') || id.includes('viem')) return 'wallet'
          if (id.includes('ethers') || id.includes('@noble') || id.includes('@adraffy')) return 'ethers'
          if (id.includes('react')) return 'react'
          return 'vendor'
        }
      }
    }
  }
})
