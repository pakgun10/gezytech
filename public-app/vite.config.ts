import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/chat": {
        target: "http://localhost:3005",
        changeOrigin: true,
      },
      "/api/sessions": {
        target: "http://localhost:3005",
        changeOrigin: true,
      },
      "/api/session": {
        target: "http://localhost:3005",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
