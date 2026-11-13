# Decisions

Structural decisions, or ones that affect other parts of the system or later milestones.
Newest first. Format: **Date · Decision**, then why and what it affects.

## 2026-11-13 · Build in France first; China check runs in parallel

- **Decision:** M0 is the scaffold deployed to `workers.dev` (no diagnostics page). M1 (camera
  and OCR) starts straight after. The China check is no longer a gate before M1: it runs as
  soon as the domain exists and must pass before the China user is invited (M3).
- **Why:** get a usable app sooner, and test the other big risk (OCR speed and word-box
  accuracy) early. Most code doesn't depend on the China result; a failure mostly changes
  hosting (HK/SG server in front of the Worker).
- **Risk accepted:** if the China user's browser is WeChat's built-in one, parts of the camera
  and OCR loading may need rework. Mitigated by the photo-picker and WASM fallbacks in M1.
- **Affects:** SPEC milestones, acceptance checks and risks. A small `/diag` page (voice, model
  download, origin check) is built later for the China check.

## 2026-11-12 · Lookups: translations, with a lenient size check

- **Decision:** `meaningInContext` is a short English translation, not a definition. The prompt
  asks for ≤ 80 characters; the schema rejects only > 120. Extra `otherMeanings` beyond 3 are
  dropped instead of failing the lookup.
- **Why:** a correct but slightly long reply shouldn't become a "Couldn't translate" error.
- **Affects:** `shared/src/schemas.ts`, `worker/prompts/lookup.v1.md`, the popup layout (M2).

## 2026-11-12 · Speech fallback returns MP3

- **Decision:** `POST /api/tts` returns `audio/mpeg`, not `audio/wav` as first specced.
- **Why:** MeloTTS on Workers AI returns MP3; converting adds work for no benefit.
- **Affects:** `worker/src/routes/tts.ts`, the web audio player and its on-device cache (M2).

## 2026-11-12 · Qwen3 thinking off; JSON mode pending

- **Decision:** thinking is turned off with Qwen3's `/no_think` switch, and any stray
  `<think>` block is stripped before parsing. JSON mode is not used yet; replies are parsed
  tolerantly and always validated with Zod.
- **Why:** thinking adds seconds per lookup (target p50 < 2 s). Neither JSON-mode support nor
  `/no_think` is confirmed for this model on Workers AI.
- **Affects:** `worker/src/lib/model.ts`. **First deploy to verify:** lookup timings show thinking is off,
  and whether JSON mode works. Update this entry with the result.

## 2026-11-11 · Hosting stays on Cloudflare; `workers.dev` until the domain

- **Decision:** deploy to `lingua-camera.<account>.workers.dev` first; buy a custom domain before
  the China check. No Chinese host.
- **Why:** mainland hosting needs an ICP filing, unavailable to a foreign individual; Chinese
  providers' free tiers serve China from outside the mainland, like Cloudflare, without D1 or
  Workers AI. `workers.dev` is blocked in China, so the China test needs the domain.
- **Affects:** `worker/wrangler.jsonc` (add `routes` for the domain). Fallback if China access is
  poor: a Hong Kong/Singapore server in front of the Worker (see SPEC Risks).
