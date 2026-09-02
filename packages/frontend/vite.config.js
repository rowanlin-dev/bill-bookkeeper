import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 通过 --mode offline 启用离线单文件构建（对应 .env.offline 中的 VITE_OFFLINE=true）
export default defineConfig(({ mode }) => {
  const isOffline = mode === 'offline'
  return {
    plugins: [vue(), ...(isOffline ? [viteSingleFile()] : [])],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    // 离线单文件需相对路径；在线用根路径
    base: isOffline ? './' : '/',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: isOffline ? 'dist-offline' : 'dist',
    },
  }
})
