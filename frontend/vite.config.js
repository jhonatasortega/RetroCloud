import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,  // desativa sourcemaps — reduz tamanho
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        }
      }
    }
  },
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api':    { target: 'http://backend:5000', changeOrigin: true },
      '/static': { target: 'http://backend:5000', changeOrigin: true },
    },
  },
})
