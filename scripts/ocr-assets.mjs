// Prepares OCR runtime files in web/public (gitignored); run by dev and build
/* global console, fetch, Buffer */
// Models are checked against pinned SHA-256 hashes. Change a hash only on purpose.
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "web", "public");
const BASE =
  "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0";

const MODELS = {
  "PP-OCRv5_mobile_det": "781056046c9ed77a15c94681605db6a0f62317c2e9cce6931c71da2478d4bc30",
  "PP-OCRv5_mobile_rec": "f7e792bc836f36e7ef895ad47c426d75b0b75b1650caa6d63fe9418441ffba8c",
  "latin_PP-OCRv5_mobile_rec": "0fd8634124d871d25492311da077517ba3b4277ea67a0dec9e46ce537978c7cb",
};

// Plain WASM build only: the WebGPU build (jsep, 29 MB) exceeds Cloudflare's 25 MiB file limit
const ORT_FILES = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function fetchModel(name, expected) {
  const target = join(publicDir, "models", `${name}.tar`);
  try {
    if (sha256(await readFile(target)) === expected) return;
  } catch {
    // missing: download below
  }
  console.log(`downloading ${name}`);
  const res = await fetch(`${BASE}/${name}_onnx_infer.tar`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (sha256(bytes) !== expected) throw new Error(`${name}: hash mismatch, file not saved`);
  await writeFile(`${target}.part`, bytes);
  await rename(`${target}.part`, target);
}

await mkdir(join(publicDir, "models"), { recursive: true });
await mkdir(join(publicDir, "ort"), { recursive: true });
await Promise.all(Object.entries(MODELS).map(([name, hash]) => fetchModel(name, hash)));
for (const file of ORT_FILES) {
  await copyFile(
    join(root, "node_modules", "onnxruntime-web", "dist", file),
    join(publicDir, "ort", file),
  );
}
