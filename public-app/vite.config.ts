import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api/chat": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/api/sessions": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/api/session": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
