// Web build (output: web/dist, served by the Worker)
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev only: forward API calls to `wrangler dev`, so the app stays single-origin
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  build: { outDir: "dist", sourcemap: true },
});
