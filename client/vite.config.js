import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Cho phép truy cập từ mọi IP trong mạng
    port: 80, // Port cố định
    cors: true, // Bật CORS cho Vite dev server
  },
});
