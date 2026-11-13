import { describe, expect, it } from "vitest";
import { ORT_WASM_ASSET } from "../../vite-plugins/dropOrtWasm.ts";

describe("ORT_WASM_ASSET", () => {
  it("matches the bundled ONNX Runtime WASM", () => {
    expect(ORT_WASM_ASSET.test("assets/ort-wasm-simd-threaded-qh98TCA_.wasm")).toBe(true);
  });

  it("leaves other files alone", () => {
    for (const name of ["assets/index-abc.js", "ort/ort-wasm-simd-threaded.wasm", "assets/other.wasm"]) {
      expect(ORT_WASM_ASSET.test(name)).toBe(false);
    }
  });
});
