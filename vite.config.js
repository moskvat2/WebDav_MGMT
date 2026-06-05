import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api/webdav': {
        target: 'http://172.16.0.99:5005',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/webdav/, ''),
        configure: (proxy, options) => {
          // You can debug proxy requests if needed
        }
      }
    }
  }
})

