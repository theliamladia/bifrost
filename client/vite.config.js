import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Keeps the SerpAPI key and the approval authority server-side; the client
    // never talks to SerpAPI directly.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
});
