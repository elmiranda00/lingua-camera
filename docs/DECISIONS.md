# Decisions

Structural decisions, or ones that affect other parts of the system or later milestones.
Newest first. Format: **Date · Decision**, then why and what it affects.

## 2026-11-13 · Tier word lists: Lexique 3.83 (CC BY-SA 4.0) and HSK 3.0 levels 1–2

- **Decision:** the French "common" list holds every form of the 2,000 most frequent Lexique 3.83
  lemmas; the Chinese list is HSK 3.0 levels 1–2 (1,256 words, not HSK 2.0's ~300). Both are
  committed as small JSON, built by `scripts/build-wordlists.mjs` from hash-pinned sources.
- **Why:** lemma-based matching stops inflections such as *mangeaient* showing as Key; HSK 3.0 is the
  current standard and gives a useful beginner cut. Lexique is share-alike, so the French list file stays CC BY-SA 4.0 with credits.
- **Affects:** `web/src/tiers/`, `web/src/lang/`, the licence notice in `web/src/tiers/data/NOTICE.md`.

## 2026-11-13 · OCR: own worker, WASM-only runtime, OpenCV patched for the CSP

- **Decision:** run PaddleOCR.js inside our own Web Worker (not its prebuilt one), with the
  WASM-only ONNX Runtime, and patch OpenCV.js at build time to remove `new Function` and a
  `data:` fetch. The CSP is unchanged (no `unsafe-eval`).
- **Why:** the prebuilt worker needs a 29 MB WebGPU file (over Cloudflare's 25 MiB per-file limit),
  and OpenCV's generated code is blocked by the CSP. Loosening the CSP was rejected.
- **Measured (desktop Chromium, 1 thread):** French page 4.3 s, Chinese menu (186 lines) 11.1 s;
  text and boxes accurate on both. Phone timing and threads/WebGPU are decided at checkpoint 3.
- **Affects:** `web/vite.config.ts`, `web/vite-plugins/opencvCsp.ts`, `web/src/ocr/`. An OpenCV or
  PaddleOCR.js upgrade must re-run the patch test. Fallback if patching breaks: run ONNX Runtime
  directly without OpenCV.

## 2026-11-13 · No custom domain for v1; the China user connects through a VPN

- **Decision:** stay on `lingua-camera.<subdomain>.workers.dev`. The China user already uses a
  VPN and is fine with it, so "works without a VPN" is a later option, not a v1 goal.
- **Why:** saves the ~€10/year domain and a setup step. Also confirmed: the China user opens
  links in Chrome (not WeChat), so the live viewfinder is his main path.
- **Risk accepted:** the app is unusable for him whenever his VPN is off or flaky.
- **Affects:** SPEC goal 4, principle 1, milestones, risks. Reversible later: add a custom domain
  (`routes` in `worker/wrangler.jsonc`) or a HK/SG server in front of the Worker. The one-origin
  rule (no CDNs, CSP `default-src 'self'`) is unchanged.

## 2026-11-13 · Build in France first; China check runs in parallel

- **Decision:** M0 is the scaffold deployed to `workers.dev` (no diagnostics page). M1 (camera
  and OCR) starts straight after. The China check is no longer a gate before M1: the China user
  opens the app through his VPN, and it should pass before he is invited (M3).
- **Why:** get a usable app sooner, and test the other big risk (OCR speed and word-box
  accuracy) early. Most code doesn't depend on the China result; a failure mostly changes
  hosting (HK/SG server in front of the Worker).
- **Risk accepted:** the China user's phone may lack WebGPU, making OCR slower (WASM fallback in
  M1). The WeChat risk was closed: he uses Chrome.
- **Affects:** SPEC milestones, acceptance checks and risks. A small `/diag` page (voice, model
  download, origin check) is built later for the China check.

## 2026-11-12 · Lookups: translations, with a lenient size check

- **Decision:** `meaningInContext` is a short English translation, not a definition. The prompt
  asks for ≤ 80 characters; the schema rejects only > 120. Extra `otherMeanings` beyond 3 are
  dropped instead of failing the lookup.
- **Why:** a correct but slightly long reply shouldn't become a "Couldn't translate" error.
- **Affects:** `shared/src/schemas.ts`, `worker/prompts/lookup.v1.md`, the popup layout (M2).

## 2026-11-13 · MeloTTS speaks Chinese, but not reliably on single words

- **Decision:** keep `speechSynthesis` as the primary voice. MeloTTS stays as the fallback, and
  its Chinese use is **to be validated in M2** (deferred).
- **Why:** checked on the live Worker by transcribing the audio with Whisper. A full sentence
  (`出口在左边。`) came back exact; French "bonjour" too. A bare `出口` came back as a breath
  (heard as "Oh" / "好"). `出口，出口。` and carrier phrases (`这是出口。`) transcribed correctly;
  `谢谢` worked bare, so it varies by word. Speech took ~3 s for a short sentence.
- **Open (M2):** pick a rule for short Chinese words (send the word twice, or a carrier phrase)
  and test it on more words, ideally with the China user listening. If none is reliable, hide
  🔊 on phones without a Chinese voice.
- **Affects:** `worker/src/routes/tts.ts`, the web audio player (M2).

## 2026-11-12 · Speech fallback returns MP3

- **Decision:** `POST /api/tts` returns `audio/mpeg`, not `audio/wav` as first specced.
- **Why:** MeloTTS on Workers AI returns MP3 (confirmed 2026-11-13: the files play and transcribe);
  converting adds work for no benefit.
- **Affects:** `worker/src/routes/tts.ts`, the web audio player and its on-device cache (M2).

## 2026-11-12 · Qwen3 thinking off (verified); JSON mode not used

- **Decision:** thinking is turned off with Qwen3's `/no_think` switch, and any stray
  `<think>` block is stripped before parsing. JSON mode is not used; replies are parsed
  tolerantly and always validated with Zod.
- **Why:** thinking adds seconds per lookup (target p50 < 2 s).
- **Verified 2026-11-13 on the live Worker:** `model_ms` 707 and 1 attempt for a Chinese lookup;
  four test lookups returned valid output (500–800 ms round trip from France). Thinking is off.
  JSON mode isn't needed so far; revisit if retries (`attempts` 2) show up in the logs.
- **Observed:** `otherMeanings` returned English inflections ("eat", "ate", "eating") instead of
  other senses. Fix with a new `lookup.v2` prompt in M2; don't edit v1.
- **Affects:** `worker/src/lib/model.ts`, `worker/prompts/`.

## 2026-11-11 · Hosting stays on Cloudflare; `workers.dev` until the domain

- **Decision:** deploy to `lingua-camera.<account>.workers.dev`. No Chinese host. (A custom
  domain is deferred: see "No custom domain for v1".)
- **Why:** mainland hosting needs an ICP filing, unavailable to a foreign individual; Chinese
  providers' free tiers serve China from outside the mainland, like Cloudflare, without D1 or
  Workers AI.
- **Affects:** `worker/wrangler.jsonc`. Fallback if China access is poor: a Hong Kong/Singapore
  server in front of the Worker (see SPEC Risks).
