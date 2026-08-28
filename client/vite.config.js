import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Keeps API keys and OTP delivery server-side; the client never talks to
    // SerpAPI, Twilio, or Postmark directly.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
});
