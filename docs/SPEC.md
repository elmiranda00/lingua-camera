# Lingua Camera — v1 Spec

Nov 10, 2026 · @Elrich Miranda

## Overview

v1 is a phone web app: photograph a page or a sign, tap any word, see its English meaning in context, hear it, and save it to a personal word bank. It supports French → English and Mandarin Chinese → English (with pinyin), for at most 10 invited users in France/EU and mainland China, at zero running cost.

**Users**

- Reader in France: French novels and web articles.
- Learner in mainland China: basic Mandarin, reading signboards and posters; needs pinyin and audio.

**Goals**

1. Shutter → boxes over every word in under 2-4 s on a mid-range phone.
2. Tap → in-context translation in under 2 s (p50), with pinyin and audio for Chinese.
3. Save in one tap; saved words show shaded grey the next time they appear.
4. Works without a VPN in mainland China, and costs €0/month to run (a domain at about €10/year is the only cost).

**Non-goals for v1**

- Live camera tracking (boxes on a moving video feed).
- Phrase selection by dragging, paste-text mode, spaced-repetition reviews.
- Context aware word translation as well as identification of phrases
- Languages beyond French and Mandarin; English UI only.
- Native apps, offline lookups, public sign-up.

## Constraints and principles

Every design choice below follows from one rule: the user's browser talks only to our own domain, and everything heavy that can run on the phone does.

1. **Reachable from mainland China without a VPN.** Google services are blocked there, and so are `workers.dev`, Hugging Face and many public CDNs. The app is served from a custom domain on Cloudflare, and every runtime file (JS, WASM, OCR models, fonts) is served from that domain. A strict Content Security Policy (`default-src 'self'`) enforces this.
2. **Free to run for ≤10 users.** Cloudflare's free plan covers hosting, the API, the database and model inference. Nothing is billed per use; the Workers AI free allocation fails closed when used up instead of charging.
3. **Open-source software and open-weight models.** Hosting is Cloudflare's (proprietary, free); everything running on it is open and portable: SQLite-compatible storage, standard `fetch` code, Apache-2.0 or MIT models and libraries.
4. **Photos never leave the phone.** OCR runs in the browser. Only the tapped word and its sentence are sent to the server.
5. **No Google APIs, no third-party trackers or analytics.**
6. **Pinned dependencies.** A lockfile, exact versions, and a short review before upgrading anything that handles secrets or model calls.

## User flows and screens

The app has three screens: Camera (home), Word bank, and a small Settings sheet. The core flow is shutter → boxes → tap → popup → save.

**Camera (home)**

- Full-screen rear-camera viewfinder (`getUserMedia`), one large shutter button, a language chip (FR / 中文) top-left, a word-bank icon top-right.
- Fallback: if the browser blocks live camera access (some in-app browsers), show a "Take photo" button using `<input type="file" accept="image/*" capture="environment">`, plus "Choose from gallery".
- After the shutter: the frame freezes, a spinner shows "Reading text…", then boxes are drawn over every word. A "Retake" button returns to the viewfinder. Pinch to zoom on the frozen photo.

**Box overlay: three visual tiers**

| Tier | Applies to | Style |
| --- | --- | --- |
| Saved | Word or phrase already in this user's bank | Light grey fill (about 25% opacity), thin grey outline |
| Key | Content words that are less common (outside the top \~2,000 by frequency for French, or above HSK 2 for Mandarin) | Thicker coloured outline, rounded, slightly larger padding |
| Normal | Everything else, including stop words | Thin, light outline |

All boxes are tappable, stop words included. Saved takes priority over Key. The tier rules are in the language pipelines section.

**Tap → popup (bottom sheet)**

- Shows at once: the word as written, and for Chinese its pinyin with tone marks (computed on the phone, no wait).
- Fills in within about 2 s: dictionary form, English meaning in this context, part of speech, gender for French nouns, and one line of other common meanings.
- 🔊 plays pronunciation. **Save** adds it to the bank (button becomes "Saved ✓"; tapping again removes it). The box turns grey immediately.
- Errors: "Couldn't translate right now — try again" with a retry button; Save stays disabled until a translation has loaded.

**Settings sheet**

- Language: French or Mandarin (Simplified). The choice is remembered on the device and picks the OCR model and prompts.
- Who's signed in, and a "Sign out of this device" link.

**Word bank**

- Tabs: French | 中文. Sorted alphabetically: French with French collation (accents sorted correctly, `Intl.Collator('fr')`); Chinese by pinyin, tones ignored for ordering (`Intl.Collator('zh-u-co-pinyin')`).
- Each row: word, pinyin (Chinese), English meaning, 🔊. Tap a row to expand the saved context sentence and the date saved. Swipe or long-press to delete.
- A search box filters by word, pinyin (with or without tones) or English.

## Architecture and tech stack

One Cloudflare Worker on our custom domain serves both the web app and the API; OCR, word splitting, pinyin and speech run on the phone, so only small text requests cross the network.


The app and OCR models download once and are cached; after that, each tap is one small JSON request to the Worker, which calls Workers AI and D1.

| Layer | Choice | Licence | Runs on |
| --- | --- | --- | --- |
| Frontend | Vite + React + TypeScript, installable PWA | MIT | Phone |
| OCR | PaddleOCR.js (`@paddleocr/paddleocr-js`), PP-OCRv5 mobile models, in a Web Worker; WebGPU when available, else WASM | Apache-2.0 | Phone |
| Chinese word splitting | `Intl.Segmenter('zh', {granularity: 'word'})` | Built into the browser | Phone |
| Pinyin | `pinyin-pro` | MIT | Phone |
| Pronunciation | Web Speech API (`speechSynthesis`, phone's built-in voices); fallback: MeloTTS on Workers AI | Built-in / MIT | Phone / Cloudflare |
| Word frequency lists | French: Lexique 3 top-N list; Mandarin: HSK 1–2 word list. Bundled as small JSON | Open data (check licences in M1) | Phone |
| API | Cloudflare Worker with Hono, request validation with Zod | MIT | Cloudflare |
| Static hosting | Workers Static Assets (same Worker, same domain) | — | Cloudflare |
| Database | D1 (SQLite) | — | Cloudflare |
| Translation model | Workers AI: `@cf/qwen/qwen3-30b-a3b-fp8`, thinking turned off; alternative `@cf/mistralai/mistral-small-3.1-24b-instruct` | Apache-2.0 weights | Cloudflare |
| Tests | Vitest (unit), Playwright (one end-to-end smoke test) | MIT/Apache-2.0 | CI / local |

**Repo layout**

```
/web        React app (camera, overlay, popup, word bank)
/worker     Hono API, D1 migrations, prompts/
/shared     Zod schemas and TypeScript types used by both
/docs       SPEC.md (this document, exported)
```

The translation model is chosen by one config value, so swapping Qwen for Mistral, or later for a self-hosted model behind an OpenAI-compatible endpoint, needs no code change.

## Language pipelines

Both languages share one pipeline (photo → OCR → word boxes → tiers → tap lookup); they differ in the OCR model, how a line splits into words, and how words are matched and sorted.

| Step | French | Mandarin (Simplified) |
| --- | --- | --- |
| Image prep | Downscale to 1600 px on the long side, JPEG quality 0.85, keep the original for display | Same |
| OCR models | `PP-OCRv5_mobile_det` + `latin_PP-OCRv5_mobile_rec` | `PP-OCRv5_mobile_det` + `PP-OCRv5_mobile_rec` (also reads English and pinyin on signs) |
| Line → words | `Intl.Segmenter('fr', {granularity:'word'})`; elisions split (`l'` + `homme`), hyphenated compounds kept whole | `Intl.Segmenter('zh', {granularity:'word'})` on the line text |
| Word boxes | Line box split by character count (approximate); use per-character positions instead if PaddleOCR.js exposes them | Characters are evenly spaced, so each gets an equal share of the line; a word box is the union of its characters. Vertical lines (height > 2× width) split top to bottom |
| Sentence context | Lines joined in reading order within a block; end-of-line hyphenation rejoined (`extra-` + `ordinaire`); cut at `. ! ? …`; max 300 characters | Lines joined without spaces; cut at `。！？`; max 300 characters. A sign with no punctuation sends its whole text block |
| Key-word tier | Lower-cased form not in the Lexique top-2,000 list, and not a capitalised name mid-sentence | Word not in the HSK 1–2 list, and not punctuation or a number |
| Saved-word match | Normalise: lower-case, Unicode NFC, strip elision prefix and punctuation; match the saved headword or any saved surface form | Exact string match on the saved headword; a saved phrase shades every box it spans in the line text |
| Pinyin | — | `pinyin-pro` on the whole word (handles characters with several readings), tone marks; also stored without tones for search and sort |
| Speech | `speechSynthesis`, `lang='fr-FR'` | `speechSynthesis`, `lang='zh-CN'`, rate 0.9 |
| Word bank order | `Intl.Collator('fr')` on the headword | `Intl.Collator('zh-u-co-pinyin')` on the headword, falling back to sorting by toneless pinyin |

**Saved-word matching, French detail.** Inflected forms only match after they have been looked up once: each lookup records the surface form against its headword, and saving keeps the list. So *mangeaient* shades grey once it is saved; *mangerons* shades only after it is tapped and its headword turns out to be *manger*. Good enough for v1.

**Speech fallback.** If the phone has no voice for the language, the 🔊 button calls `/api/tts` (MeloTTS on Workers AI) and caches the audio on the device. M0 confirms whether MeloTTS on Workers AI supports Chinese; if it does not, the button is hidden on phones without a Chinese voice.

**Pinyin from two sources.** The model also returns pinyin. The app shows the `pinyin-pro` result and logs any disagreement, which becomes a test case for the eval set.

## Data model and API

Four D1 tables and six endpoints cover v1; every request and response is defined once as a Zod schema in `/shared` and checked on both sides.

**Tables**

| Table | Columns | Notes |
| --- | --- | --- |
| `users` | `id` (uuid, PK), `name`, `token_hash` (SHA-256, unique), `created_at`, `disabled` (0/1) | Created by hand with a script; no sign-up |
| `entries` | `id` (uuid, PK), `user_id` (FK), `lang` (`fr` / `zh`), `headword`, `surface_forms` (JSON array), `pinyin`, `pinyin_plain`, `translation`, `other_meanings` (JSON array), `pos`, `gender` (`m` / `f` / null), `context`, `kind` (`word` / `phrase`), `created_at` | Unique on (`user_id`, `lang`, `headword`); index on (`user_id`, `lang`) |
| `lookup_cache` | `key` (PK), `response` (JSON), `created_at` | Key = SHA-256 of lang, model, prompt version, normalised word, normalised sentence |
| `usage` | `user_id`, `day` (UTC date), `lookups`, `tts` | PK (`user_id`, `day`); used for the daily caps |

**Endpoints** (JSON over HTTPS, `Authorization: Bearer <token>` on all but health)

| Method and path | Body / query | Returns |
| --- | --- | --- |
| `GET /api/health` | — | `{ok: true, version}` |
| `GET /api/me` | — | `{id, name}` |
| `POST /api/lookup` | `{lang, word, sentence}` | `LookupResult` (below) + `cached`, `requestId` |
| `GET /api/words` | `?lang=fr\|zh` | All of the user's entries for that language (sorted on the phone) |
| `POST /api/words` | `{lang, headword, surface, pinyin?, translation, otherMeanings, pos, gender?, context, kind}` | The entry. If the headword exists, adds `surface` to `surface_forms` instead of duplicating |
| `DELETE /api/words/:id` | — | `204` |
| `POST /api/tts` | `{lang, text}` (text ≤ 40 characters) | `audio/wav`; only used when the phone has no voice |

**`LookupResult` contract**

```json
{
  "surface": "mangeaient",
  "headword": "manger",
  "pos": "verb",
  "gender": null,
  "pinyin": null,
  "meaningInContext": "(they) were eating",
  "otherMeanings": ["to eat", "to use up (money, time)"],
  "note": null
}
```

- `pos` is one of: noun, verb, adjective, adverb, pronoun, determiner, preposition, conjunction, particle, classifier, numeral, interjection, phrase, other.
- `headword`: French dictionary form (infinitive, masculine singular); Chinese = the word itself in Simplified characters.
- `meaningInContext` ≤ 80 characters; `otherMeanings` ≤ 3 items; `note` names a fixed expression the word belongs to (e.g. *avoir beau*), else null.

**Lookup prompt**

- Stored as a file, `worker/prompts/lookup.v1.md`; the version string is logged with every request and is part of the cache key.
- Input: the language, the tapped word, the sentence. Output: JSON only, English meanings, no invented senses; if the word is part of an expression, still translate the word and name the expression in `note`.
- Use Workers AI JSON mode where the model supports it; always validate with Zod; retry once on invalid output, then return an error the popup can show.

## Security, privacy, quotas and limits

Access is by invite link only, each user is capped per day so the free model allocation can't be drained, and the server never sees a photo.

**Auth**

- An admin script (`npm run user:add -- "Name"`) creates a user and prints a one-time link `https://<domain>/join#<token>`. The token is 32 random bytes, base64url; only its SHA-256 is stored.
- The token sits in the URL fragment (never sent to servers or logs), the app moves it to `localStorage` and clears the address bar.
- Every API call sends `Authorization: Bearer <token>`; a disabled or unknown token gets `401`. Revoking = setting `disabled = 1`.

**Limits**

| Limit | Value | When exceeded |
| --- | --- | --- |
| Lookups per user per day | 150 (cache hits not counted) | `429`, popup says "Daily limit reached, resets at 01:00 Paris / 08:00 Beijing" |
| TTS calls per user per day | 100 | `429`, 🔊 hidden |
| `word` length | ≤ 40 characters | `400` |
| `sentence` length | ≤ 300 characters | `400` |
| Request body | ≤ 8 KB | `413` |
| Words in bank per user | 10,000 | `409` |

The Workers AI free allocation is 10,000 Neurons per day, reset at 00:00 UTC. At roughly 600 input and 100 output tokens per lookup, that is about 1,500 Qwen lookups a day in total, so 10 users × 150 fits exactly; cache hits cost nothing. Measure real usage in M2 and adjust the cap.

**Browser hardening**

- CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'`. Any third-party origin breaks loudly in testing, which is the point.
- Same-origin API, so no CORS headers. `Permissions-Policy: camera=(self)`.

**Privacy**

- Photos stay in memory on the phone and are discarded on Retake; nothing is uploaded.
- Stored per user: saved entries with their context sentence, and daily usage counts. Logs hold request IDs, timings and status codes, never tokens or sentences.
- Secrets (none needed beyond bindings in v1) go in `wrangler secret`, never in the repo.

## Milestones

v1 is done when M3 passes; each milestone ships something usable on a phone, and M0 is a go/no-go gate on China access.

| Milestone | Delivers |
| --- | --- |
| **M0 · China test** (go/no-go gate) | Domain + Worker live; loads from China; OCR models + voice OK |
| **M1 · Photo to boxes** | On-phone OCR, FR + ZH; word boxes, 3 tiers; under 4 s per photo |
| **M2 · Tap to translate** | Qwen lookup + cache; pinyin and audio; under 2 s at p50 |
| **M3 · Word bank** | Invite-link sign-in; Save + grey shading; sorted A–Z / by pinyin |
| *After v1* | Phrases, paste-text, dictionaries, eval set, self-hosted benchmark |

If M0 fails, fix reachability (see Risks) before starting M1.

**Acceptance checks**

- [ ] **M0** — `https://<domain>/api/health` and a test lookup work from the China user's phone without a VPN.
- [ ] **M0** — The \~25 MB OCR model files download and cache on his phone; `speechSynthesis` speaks Chinese, or MeloTTS on Workers AI does.
- [ ] **M1** — A novel page (FR) and a street sign (ZH) both show a box on every word, with all three tiers visible; under 4 s from shutter on a mid-range phone.
- [ ] **M1** — No request leaves the device during OCR (checked in the network panel).
- [ ] **M2** — Tapping a box shows meaning in context, part of speech, and pinyin for Chinese; 🔊 plays; p50 under 2 s from France, measured from logs.
- [ ] **M2** — A repeated lookup is served from cache and does not count against the daily cap.
- [ ] **M3** — Both users sign in by invite link; Save and Remove work; a saved word shows grey on the next photo.
- [ ] **M3** — The word bank lists French A–Z with accents sorted correctly and Chinese by pinyin; search works by word, pinyin and English.

## Risks, open questions and roadmap

The biggest risk is reachability from mainland China, which is why M0 tests it before anything else is built.

**Risks**

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Cloudflare's overseas edge is slow or drops packets from China | Slow loads, failed lookups for the China user | Test in M0; keep requests tiny; fall back to a cheap Singapore/HK server in front of the same Worker, or the user's VPN |
| \~25 MB OCR model download fails or is slow from China | First use doesn't work | Cache with a service worker; show download progress; test in M0 |
| On-device OCR too slow on older phones | Long wait after the shutter | Mobile models, WebGPU where available, downscaled image; measure in M1 (target < 4 s) |
| Line-to-word box splitting misaligns on French text | Taps land on the wrong word | Use per-character positions if PaddleOCR.js exposes them; otherwise widen hit areas; Tesseract.js (`fra`) as plan B for French only |
| Phone lacks a Chinese voice, and MeloTTS on Workers AI lacks Chinese | No audio | Confirm in M0; hide 🔊 gracefully |
| Workers AI model is retired or renamed | Lookups fail | Model name is a config value; Mistral Small is the tested alternative |
| Free allocation used up | Lookups fail until 00:00 UTC | Per-user caps, cache, clear message in the popup |

**Open questions**

- [ ] Product name and domain ("Lexi Lens" is a working name).
- [ ] Does the China user open links in WeChat's built-in browser or a normal browser? This decides whether the live viewfinder or the photo-picker fallback is the main path for him.
- [ ] Traditional characters: needed for any user (Hong Kong, Taiwan signage), or Simplified only?
- [ ] Licences of the frequency lists (Lexique 3, HSK lists) confirmed for bundling.

**After v1**

1. Drag across boxes to look up and save a phrase.
2. Paste-text mode for web articles (same tappable words, no OCR).
3. Open dictionaries in D1 (CC-CEDICT for Chinese, kaikki/Wiktionary for French) to ground the model and answer simple words without a model call.
4. A bilingual eval set of tricky sentences; compare Qwen vs Mistral per language.
5. Self-host the same open model (llama.cpp or vLLM) and benchmark latency and cost against Workers AI.
6. Spaced-repetition review mode (FSRS).
