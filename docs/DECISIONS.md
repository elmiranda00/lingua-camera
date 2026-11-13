# Decisions

Structural decisions, or ones that affect other parts of the system or later milestones.
Newest first. Format: **Date · Decision**, then why and what it affects.

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

- **Decision:** deploy to `lingua-camera.<account>.workers.dev`. No Chinese host. (A custom
  domain is deferred: see "No custom domain for v1".)
- **Why:** mainland hosting needs an ICP filing, unavailable to a foreign individual; Chinese
  providers' free tiers serve China from outside the mainland, like Cloudflare, without D1 or
  Workers AI.
- **Affects:** `worker/wrangler.jsonc`. Fallback if China access is poor: a Hong Kong/Singapore
  server in front of the Worker (see SPEC Risks).
