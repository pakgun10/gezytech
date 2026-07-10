import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api/connections/google-drive": {
        target: "http://localhost:3002",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:3004",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
