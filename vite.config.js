import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,   // no exponer source maps en producción
    minify: true,       // bundle optimizado
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // separa vendor de app para chunks más chicos y mejor cache
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
        },
      },
    },
  },
})
