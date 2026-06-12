import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/remote": {
        target: "https://api.wutomi.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/remote/, ""),
      },
    },
  },
});
