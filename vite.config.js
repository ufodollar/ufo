import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
    // 🚨 修复：兼容底层 Web3 库的 process.env 读取
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
})