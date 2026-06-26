import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin in prod (nginx) and dev (this proxy) — no CORS, no base-URL env var.
// Backend port from repo-root .env.example (PORT=4000); not yet running in this build phase.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
