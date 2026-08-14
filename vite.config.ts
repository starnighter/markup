import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 生产环境用自定义协议加载资源，必须使用相对路径
export default defineConfig({
  base: "./",
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || "localhost",
  },
  build: {
    target: "es2021",
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: "jsdom",
  },
});
