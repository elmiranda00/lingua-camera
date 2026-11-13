# ocr

## Purpose

Reads text from a photo on the phone, in a background thread. Photos never leave the device.

## How it works

1. `warmup.ts` runs when the camera page opens (and when the language changes). It downloads the
   ONNX Runtime and the models for that language, reporting progress. The service worker (`public/sw.js`) caches every file, so this only downloads once.
2. It then asks the worker to load the models (`loadOcr`).
3. After a photo, `recognize(lang, bitmap)` sends the image to `ocr.worker.ts` and gets back lines: a polygon, text and score each.
4. The worker turns the bitmap into an OpenCV image, runs PaddleOCR (detect lines, then read them) and returns the result.

## Key files

| File | Role |
| --- | --- |
| `engine.ts` | Page side: starts the worker, `loadOcr`, `recognize`, thread count |
| `ocr.worker.ts` | Worker: one PaddleOCR engine per language and thread count |
| `protocol.ts` | Messages between page and worker |
| `warmup.ts` | Download with progress, then model load; shared per language |

## Interfaces

`loadOcr(lang)`, `recognize(lang, image)`, `subscribeWarmUp(lang, listener)`. Files come from
`/models/*.tar` and `/ort/*`, written to `web/public/` by `npm run assets` (sizes in `/ocr-assets.json`).

## Running and testing

Covered by the browser smoke test (`npm run test:e2e`), which reads a generated photo end to end.
The word-splitting side is unit-tested in `web/test/lang` and `web/test/tiers`.

## Design choices

- **Threads: up to 4, or half the cores, only when the page is cross-origin isolated.** Measured on a laptop: French page 4.5 s on 1 thread, 1.8 s on 4; Chinese menu 11 s vs 4.3 s.
- **The image is shrunk to 1600 px on the long side before OCR** (`camera/photo.ts`); box positions are in that size.
- **Models load on page open, not on the first photo,** so the first shot isn't slow.

## Gotchas

- Always pass `ortOptions.wasmPaths`: the library's default is a CDN.
- The page must be served with the isolation headers (see `worker/src/security.ts`) or OCR drops to one thread.
- `recognize` transfers the bitmap to the worker; it can't be used afterwards.
- Changing a model or runtime file means bumping `MODELS` in `public/sw.js`, or phones keep the old copy.
