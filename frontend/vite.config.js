import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, requests to /api and /uploads go to the backend on port 5000
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
});
