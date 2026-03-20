import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prevent duplicate React instances (causes invalid hook call with react-router-dom v7)
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  build: {
    // Output directly into the API's wwwroot so ASP.NET Core serves the SPA
    outDir: '../KaseLog.Api/wwwroot',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
