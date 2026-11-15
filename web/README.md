# web

## Purpose

The phone app: React + Vite, built to static files that the Worker serves. The home page is the
camera: take or pick a photo, read it on the phone, and get a tappable box on every word.

## How it works

1. The browser loads `index.html` and one JS bundle from the Worker. Nothing comes from any other origin.
2. `main.tsx` first imports `shared/browser-setup` (turns off Zod's `eval` probe), then mounts `App`.
3. `App` creates the router. The router matches the URL, runs that route's loader, then renders the page.
4. A loader calls the API client, which calls `/api/*`, validates the reply with a `shared` schema,
   and throws a typed error on any failure.
5. A page that fails to load shows the route's error page instead of a blank screen.

**The camera page** (see `src/camera/`): shutter → photo shrunk to 1600 px → OCR in a Web Worker
(see `src/ocr/`) → one polygon and text per **line** → `src/lang/` splits lines into word boxes →
`src/tiers/` marks each Saved, Key or Normal → boxes are drawn over the photo.

**Tap to translate** (see `src/lookup/`): a tap on a box asks `createSentenceFinder` for the word's sentence and
starts a lookup (`POST /api/lookup`). A bottom sheet shows the meaning, part of speech and, for Chinese, pinyin
(from `pinyin-pro`, loaded on demand), all at once when the answer arrives. Tapping another word replaces the content.

**Offline files:** a service worker (`public/sw.js`) caches the OCR models, the ONNX Runtime and the
app's hashed files, so the ~30 MB download happens once. `npm run assets` puts them in `public/`.

## Key files

| File | Role |
| --- | --- |
| `src/main.tsx` | Entry point |
| `src/App.tsx` | Creates the browser router |
| `src/routes.tsx` | Route table: loader, loading page and error page per route |
| `src/pages/` | `Camera` (home), `Join` (invite-link sign-in), `About`, `NotFound`, `Loading`, `RouteError`, loaders |
| `src/auth/` | Sign-in token in localStorage (`token.ts`) and the invite-link flow (`join.ts`) |
| `src/lookup/` | Translation sheet: lookup controller (cache, cancel, errors), React hook, `WordSheet` |
| `src/brand/` | `Glyph`: the app glyph as an inline SVG (masters in `docs/brand/`) |
| `src/camera/` | Camera page pieces: viewfinder, photo view, word boxes, zoom. See its README |
| `public/sw.js` | Service worker: caches OCR files and the app |
| `public/manifest.webmanifest`, icons | Makes the app installable (Add to Home Screen). Icons are made by `../scripts/make-icons.mjs` from `docs/brand/app-icon.svg` |
| `src/api/client.ts` | API client: validation, typed errors, 10 s timeout, request-ID logging |
| `src/ocr/` | On-phone OCR in a Web Worker, model download with progress. See its README |
| `src/lang/` | Per-language modules (word splitting, word boxes, key-word rule). See its README |
| `src/tiers/` | Saved / Key / Normal tier rules and the word lists. See its README |
| `vite-plugins/` | `opencvCsp.ts`: build-time patch so OpenCV.js runs under our CSP. `dropOrtWasm.ts`: leaves out a duplicate 15 MB WASM file |
| `../scripts/ocr-assets.mjs` | Downloads the models (hash-checked) and copies the ORT WASM into `public/` (gitignored) |
| `vite.config.ts` | Build to `dist/`; in dev, forwards `/api` to the local Worker |
| `test/` | Unit tests, mirroring `src/` |
| `test/ocr/__fixtures__/` | Real OCR output (JSON) from a French book page and a Chinese menu |
| `test/e2e/smoke.spec.ts` | Browser smoke test: loads the built app through the Worker, fails on CSP violations, errors or other origins |

## Interfaces

| Route | Page |
| --- | --- |
| `/` | Camera |
| `/join#<token>` | Signs in from an invite link |
| `/about` | Shows the API version |
| `*` | Page not found |

API client (`src/api/client.ts`): `api.getHealth()`, `api.getMe(token?)`, `api.lookup(body, { signal })`, `api.noteOcrMs(ms)`. It sends the saved token as
`Authorization: Bearer`, and the last photo's read time once as `x-ocr-ms` (for the Worker's timing logs). A cancelled
request fails with code `aborted` and is not logged. Errors are `ApiRequestError` with
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
| pinyin-pro 3.29.5 | MIT | Pinyin with tone marks for Chinese. Its own 287 kB file (142 kB gzipped), fetched only when the language is Chinese |
| onnxruntime-web 1.31.1 | MIT | Transitive: runs the models (WASM build only) |
| @techstark/opencv-js 4.10.0-release.1 | Apache-2.0 | Transitive: image processing. Patched at build time |
| clipper-lib 6.4.2 | Boost Software License 1.0 | Transitive: polygon offsets. Permissive; accepted as an exception to the MIT/Apache/BSD preference |
| js-yaml 4.3.2 | MIT | Transitive: reads model config |

Word lists (data, not packages): Lexique 3.83 (CC BY-SA 4.0) and HSK 3.0 levels 1–2 (MIT repository). Credits: `src/tiers/data/NOTICE.md`.

OCR models (not npm packages, fetched by `scripts/ocr-assets.mjs`): PP-OCRv5 mobile detection,
Chinese recognition and Latin recognition (Apache-2.0, PaddlePaddle).

## Design choices

- **Data router with per-route loaders and error pages**, so data loading and failure handling live in one place.
- **Sign-in token in localStorage** (as the spec says), checked with `/api/me` before it is saved. The fragment is removed from the address bar only after that succeeds, so a failed attempt can be retried by reloading.
- **Every API response is validated** against a `shared` schema; failures are logged with the request ID only.
- **Zod runs without `eval`** because the CSP forbids it. `browser-setup` must stay the first import in `main.tsx`.
- **Our own OCR worker**, not PaddleOCR's prebuilt one: the prebuilt worker bundles a WebGPU ONNX Runtime
  that needs a 29 MB file (over Cloudflare's 25 MiB limit). Ours is built by Vite with our settings.
- **WASM-only ONNX Runtime** (`onnxruntime-web/wasm` alias), single thread for now. WebGPU and threads are off.
- **OpenCV.js patched at build time** (`vite-plugins/opencvCsp.ts`): its generated code uses `new Function`
  and fetches a `data:` URL, both blocked by the CSP. The patch swaps them for plain functions. The CSP
  stays strict. A unit test fails if an OpenCV update stops the patch from matching.
- **Models served from our origin**, downloaded at build time and checked against pinned SHA-256 hashes.
- **Installable app:** a manifest (standalone, black theme) and icons, so it opens like an app from the home screen.
- **Hand-written service worker (about 60 lines), no PWA plugin:** it only needs cache-first for model and hashed files and network-first for pages. One less dependency to pin and review.
- **Multi-threaded OCR** via cross-origin isolation headers set by the Worker; falls back to one thread if they are missing.

- **The translation sheet is not modal.** The photo stays tappable behind it, so tapping another word replaces the content at once. Focus is not trapped; Esc and the × button close it.
- **Meaning and pinyin appear together.** The sheet waits for both; if `pinyin-pro` can't load it falls back to the model's pinyin.
- **Lookups are cached in memory per photo** (word + sentence), cancelled when another word is tapped, and forgotten on Retake or a language change.
- **`pinyin-pro` is loaded on demand,** and starts loading when the language switches to Chinese, so French users never download it.

## Gotchas

- `/join` reloads on `hashchange`: pasting an invite link into a tab already on `/join` changes only the fragment, which doesn't re-run the loader.
- A loader blocks the page until it finishes (up to the 10 s timeout). The camera route has none, and must stay that way.
- The camera needs HTTPS. Test on a phone against the deployed URL, not a LAN address.
- The service worker only registers in production builds.
- `npm run dev` needs a Cloudflare login, because the Worker's AI binding is remote.
- The Worker only serves what's in `web/dist`; build before `wrangler dev` or deploy.
- Check layouts at 375 px wide.
- The sheet covers up to 45% of the photo area, so words in the lower half are hidden while it is open; close it (×) to reach them.
- Always set `ortOptions.wasmPaths`: PaddleOCR's default loads ONNX Runtime from a CDN.
- PaddleOCR's own image loader needs `document`, which a worker lacks; the worker passes an OpenCV `Mat` instead.
- `npm run assets` needs internet the first time (models come from Baidu's bucket); after that, files with the right hash are kept.
- OCR returns lines, not words or characters. Word boxes come from splitting a line's box by estimated character widths (`src/lang/`).
- ONNX Runtime logs warnings about unused model weights during load; they are harmless.
