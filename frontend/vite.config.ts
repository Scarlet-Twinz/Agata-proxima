import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/verify-email": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/reset-password": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
      "/accept-invite": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
});
