import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    host: true,
    proxy: {
      // чтобы фронт ходил на /api без CORS-геморроя
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // если сокеты на /socket.io
      "/socket.io": {
        target: "http://localhost:3000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
