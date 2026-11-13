# web

## Purpose

The phone app: React + Vite, built to static files that the Worker serves. Today it has a
placeholder home page and a temporary `/ocr-test` page; M1 turns it into the camera.

## How it works

1. The browser loads `index.html` and one JS bundle from the Worker. Nothing comes from any other origin.
2. `main.tsx` first imports `shared/browser-setup` (turns off Zod's `eval` probe), then mounts `App`.
3. `App` creates the router. The router matches the URL, runs that route's loader, then renders the page.
4. A loader calls the API client, which calls `/api/*`, validates the reply with a `shared` schema,
   and throws a typed error on any failure.
5. A page that fails to load shows the route's error page instead of a blank screen.

**OCR** (see `src/ocr/`): the page sends the photo to a Web Worker (`ocr.worker.ts`), which runs
PaddleOCR: detection finds text lines, recognition reads them. It returns one polygon, text and
score per **line**. The worker loads the models (`/models/*.tar`) and the ONNX Runtime WASM
(`/ort/`) from our own origin. `npm run assets` puts them in `public/` before dev and build.

## Key files

| File | Role |
| --- | --- |
| `src/main.tsx` | Entry point |
| `src/App.tsx` | Creates the browser router |
| `src/routes.tsx` | Route table: loader, loading page and error page per route |
| `src/pages/` | `Home`, `NotFound`, `Loading`, `RouteError`, `homeLoader` |
| `src/api/client.ts` | API client: validation, typed errors, 10 s timeout, request-ID logging |
| `src/ocr/engine.ts` | Page side of OCR: `loadOcr(lang)`, `recognize(lang, image)` |
| `src/ocr/ocr.worker.ts` | OCR Web Worker: one PaddleOCR engine per language |
| `src/ocr/protocol.ts` | Messages between page and worker |
| `src/lang/` | Per-language modules (word splitting, word boxes, key-word rule). See its README |
| `src/tiers/` | Saved / Key / Normal tier rules and the word lists. See its README |
| `src/pages/OcrTest.tsx` | Temporary: pick a photo, see line boxes and timings (removed with the camera page) |
| `vite-plugins/opencvCsp.ts` | Build-time patch so OpenCV.js runs under our CSP (see Design choices) |
| `../scripts/ocr-assets.mjs` | Downloads the models (hash-checked) and copies the ORT WASM into `public/` (gitignored) |
| `vite.config.ts` | Build to `dist/`; in dev, forwards `/api` to the local Worker |
| `test/` | Unit tests, mirroring `src/` |
| `test/ocr/__fixtures__/` | Real OCR output (JSON) from a French book page and a Chinese menu |
| `test/e2e/smoke.spec.ts` | Browser smoke test: loads the built app through the Worker, fails on CSP violations, errors or other origins |

## Interfaces

| Route | Page |
| --- | --- |
| `/` | Home: shows the API version |
| `/ocr-test` | Temporary OCR check |
| `*` | Page not found |

API client (`src/api/client.ts`): `api.getHealth()`. Errors are `ApiRequestError` with
`code`, `status` and `requestId`. Schemas come from `@lingua-camera/shared`.

## Running and testing

```
npm run dev                          # from the repo root: Worker + Vite together
npm run build -w @lingua-camera/web  # writes web/dist
npx vitest run --project web
npm run test:e2e                     # from the repo root: build, start Worker, run Chromium at 375 px
npm run typecheck -w @lingua-camera/web
```

## Dependencies

| Package | Licence | Why |
| --- | --- | --- |
| react, react-dom 19 | MIT | UI |
| react-router 8 | MIT | Routing with loaders |
| vite, @vitejs/plugin-react | MIT | Build and dev server |
| @types/react, @types/react-dom | MIT | Types (dev) |
| eslint-plugin-react-hooks (root) | MIT | Lint rules for hooks (dev) |
| @paddleocr/paddleocr-js 0.4.2 | Apache-2.0 | On-phone OCR |
| onnxruntime-web 1.31.1 | MIT | Transitive: runs the models (WASM build only) |
| @techstark/opencv-js 4.10.0-release.1 | Apache-2.0 | Transitive: image processing. Patched at build time |
| clipper-lib 6.4.2 | Boost Software License 1.0 | Transitive: polygon offsets. Permissive; accepted as an exception to the MIT/Apache/BSD preference |
| js-yaml 4.3.2 | MIT | Transitive: reads model config |

Word lists (data, not packages): Lexique 3.83 (CC BY-SA 4.0) and HSK 3.0 levels 1–2 (MIT repository). Credits: `src/tiers/data/NOTICE.md`.

OCR models (not npm packages, fetched by `scripts/ocr-assets.mjs`): PP-OCRv5 mobile detection,
Chinese recognition and Latin recognition (Apache-2.0, PaddlePaddle).

Planned for M1, not installed yet:

| Package | Licence | Why |
| --- | --- | --- |
| pinyin-pro | MIT | Pinyin for Chinese |
| vite-plugin-pwa | MIT | Service worker that caches the OCR models |

## Design choices

- **Data router with per-route loaders and error pages**, so data loading and failure handling live in one place.
- **Every API response is validated** against a `shared` schema; failures are logged with the request ID only.
- **Zod runs without `eval`** because the CSP forbids it. `browser-setup` must stay the first import in `main.tsx`.
- **Our own OCR worker**, not PaddleOCR's prebuilt one: the prebuilt worker bundles a WebGPU ONNX Runtime
  that needs a 29 MB file (over Cloudflare's 25 MiB limit). Ours is built by Vite with our settings.
- **WASM-only ONNX Runtime** (`onnxruntime-web/wasm` alias), single thread for now. WebGPU and threads are off.
- **OpenCV.js patched at build time** (`vite-plugins/opencvCsp.ts`): its generated code uses `new Function`
  and fetches a `data:` URL, both blocked by the CSP. The patch swaps them for plain functions. The CSP
  stays strict. A unit test fails if an OpenCV update stops the patch from matching.
- **Models served from our origin**, downloaded at build time and checked against pinned SHA-256 hashes.

## Gotchas

- A loader blocks the page until it finishes (up to the 10 s timeout). Don't make the M1 camera route wait on an API call.
- `npm run dev` needs a Cloudflare login, because the Worker's AI binding is remote.
- The Worker only serves what's in `web/dist`; build before `wrangler dev` or deploy.
- Check layouts at 375 px wide.
- Always set `ortOptions.wasmPaths`: PaddleOCR's default loads ONNX Runtime from a CDN.
- PaddleOCR's own image loader needs `document`, which a worker lacks; the worker passes an OpenCV `Mat` instead.
- `npm run assets` needs internet the first time (models come from Baidu's bucket); after that, files with the right hash are kept.
- OCR returns lines, not words or characters. Word boxes come from splitting a line's box by estimated character widths (`src/lang/`).
- ONNX Runtime logs warnings about unused model weights during load; they are harmless.
