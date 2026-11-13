// Web build (output: web/dist, served by the Worker)
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { opencvCsp } from "./vite-plugins/opencvCsp.ts";

export default defineConfig({
  plugins: [react(), opencvCsp()],
  worker: { format: "es", plugins: () => [opencvCsp()] },
  // WASM-only ONNX Runtime: the default build also ships a 29 MB WebGPU file (over the 25 MiB asset limit)
  resolve: { alias: { "onnxruntime-web": "onnxruntime-web/wasm" } },
  server: {
    // Dev only: forward API calls to `wrangler dev`, so the app stays single-origin
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  build: { outDir: "dist", sourcemap: true },
});
