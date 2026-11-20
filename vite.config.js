import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
