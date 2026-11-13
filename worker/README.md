# worker

## Purpose

The backend: a Cloudflare Worker (Hono) that serves the web app and the `/api/*` endpoints
on one origin. It calls Workers AI for lookups and speech, and holds the D1 database.

## How it works

1. Every request gets a request ID, and every response gets the security headers.
2. `/api/*` goes to a route; anything else is served from the web build (`web/dist`).
3. A route checks auth, validates the body against its Zod schema (`shared`), then does its work.
4. Lookup: build the prompt, call the model, parse the reply with `LookupResult`, retry once if invalid.
5. One log line per API request: ID, route, status, timings, model, prompt version.

## Key files

| File | Role |
| --- | --- |
| `src/index.ts` | App entry: request ID, headers, logging, route mounting, asset fallback |
| `src/routes/` | `health`, `lookup`, `tts` |
| `src/llm.ts` | LLM settings: live prompt, temperature, max tokens, retries |
| `src/lib/model.ts` | Calls the model, parses and validates the reply |
| `src/security.ts` | CSP and other security headers |
| `src/lib/auth.ts` | M0 shared test token |
| `src/lib/body.ts`, `errors.ts`, `log.ts` | Body reading, error envelope, structured logs |
| `src/limits.ts` | Request limits (values live in `shared/src/limits.ts`) |
| `prompts/` | Versioned prompt files, e.g. `lookup.v1.md` |
| `migrations/` | D1 schema |
| `wrangler.jsonc` | Bindings, model names, assets, environment variables |

## Interfaces

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/health` | None | `{ ok, version }` |
| `POST /api/lookup` | M0 token | Returns `LookupResponse`; `502` if the model fails twice |
| `POST /api/tts` | M0 token | Returns `audio/mpeg` |

Errors are always `{ error: { code, message }, requestId }`. Schemas are in `shared`.

Config: models come from `LOOKUP_MODEL` and `TTS_MODEL` in `wrangler.jsonc`.
Secret: `M0_TOKEN` (`npx wrangler secret put M0_TOKEN`; locally in `worker/.dev.vars`).

## Running and testing

```
npm run dev -w @lingua-camera/worker          # needs a Cloudflare login and web/dist
npx vitest run --project worker               # tests run in workerd, AI mocked
npm run typecheck -w @lingua-camera/worker
npm run db:migrate:local
```

## Design choices

- **One Worker for API and web.** One origin, so no CORS and the CSP can forbid every other host.
- **Static files also go through the Worker** (`run_worker_first`), so the CSP covers every page.
- **Model output is never trusted.** Always Zod-validated; one retry, then a typed `502`.
- **Qwen3 thinking is off** (`/no_think`). Unverified on Workers AI; M0 checks the timings.
- **Logs never contain words, sentences or tokens.**
- **M0 auth is one shared token**, replaced by per-user invite tokens in M3.

## Gotchas

- The `ai` binding is remote-only. `wrangler dev` uses the real model and your free allocation;
  tests mock it and use `remoteBindings: false`.
- `wrangler dev` fails until `web/dist` exists. Until then: `wrangler dev --assets <any folder>`.
- A new prompt means a new file and a new version string in `src/llm.ts`.
- If `M0_TOKEN` is unset, lookup and TTS return `401`.
