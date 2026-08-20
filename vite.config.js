import { defineConfig, loadEnv } from 'vite'
import { FANTASYPROS_BASE_URL } from './config/fantasypros.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      proxy: {
        '/api': {
          target: FANTASYPROS_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-api-key', env.VITE_FP_API_KEY)
            })
          },
        },
      },
    },
  }
})
