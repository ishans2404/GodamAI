import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-oxc'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-three':   ['three', '@react-three/fiber', '@react-three/drei'],
          'vendor-charts':  ['recharts'],
          'vendor-motion':  ['framer-motion'],
          'vendor-ui':      ['lucide-react', 'react-hot-toast', 'zustand', 'axios'],
        }
      }
    }
  }
})
