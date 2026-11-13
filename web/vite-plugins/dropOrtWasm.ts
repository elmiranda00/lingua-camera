// Vite plugin: drops the bundled ONNX Runtime WASM (15 MB); the app loads its own copy from /ort/ instead
import type { Plugin } from "vite";

export const ORT_WASM_ASSET = /^assets\/ort-wasm-simd-threaded[\w.-]*\.wasm$/;

export function dropOrtWasm(): Plugin {
  return {
    name: "drop-ort-wasm",
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (ORT_WASM_ASSET.test(name)) delete bundle[name];
      }
    },
  };
}
