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
| `src/routes/` | `health`, `me`, `lookup`, `tts` |
| `src/llm.ts` | LLM settings: live prompt, temperature, max tokens, retries |
| `src/lib/model.ts` | Calls the model, parses and validates the reply |
| `src/security.ts` | CSP, cross-origin isolation and other security headers |
| `src/lib/auth.ts` | Per-user Bearer auth: hashes the token, looks the user up in D1 |
| `src/lib/body.ts`, `errors.ts`, `log.ts` | Body reading, error envelope, structured logs |
| `src/limits.ts` | Request limits (values live in `shared/src/limits.ts`) |
| `prompts/` | Versioned prompt files, e.g. `lookup.v1.md` |
| `migrations/` | D1 schema |
| `wrangler.jsonc` | Bindings, model names, assets, environment variables |

## Interfaces

| Endpoint | Auth | Notes |
| --- | --- | --- |
| `GET /api/health` | None | `{ ok, version }` |
| `GET /api/me` | User token | `{ id, name }` of the token's owner |
| `POST /api/lookup` | User token | Returns `LookupResponse`; `502` if the model fails twice |
| `POST /api/tts` | User token | Returns `audio/mpeg` |

Errors are always `{ error: { code, message }, requestId }`. Schemas are in `shared`.

Config: models come from `LOOKUP_MODEL` and `TTS_MODEL` in `wrangler.jsonc`.
No secrets: users are rows in D1. Create one with `npm run user:add -- "Name"` (local D1) or
`npm run user:add -- "Name" --remote` (production); it prints the invite link once.

## Running and testing

```
npm run dev -w @lingua-camera/worker          # needs a Cloudflare login and web/dist
npm run dev:smoke -w @lingua-camera/worker    # no AI binding, no login; used by the browser smoke test
npx vitest run --project worker               # tests run in workerd, AI mocked
npm run typecheck -w @lingua-camera/worker
npm run db:migrate:local
npm run user:add -- "Name"                  # from the repo root; add --remote for production
```

## Design choices

- **One Worker for API and web.** One origin, so no CORS and the CSP can forbid every other host.
- **Static files also go through the Worker** (`run_worker_first`), so the CSP covers every page.
- **Cross-origin isolation headers on every response** (COOP `same-origin`, COEP `require-corp`) so the on-phone OCR can use several threads. They don't loosen the CSP; they only work because every file is same-origin. A third-party embed or image would now be blocked.
- **Model output is never trusted.** Always Zod-validated; one retry, then a typed `502`.
- **Qwen3 thinking is off** (`/no_think`). Unverified on Workers AI; the first deploy checks the timings.
- **Logs never contain words, sentences or tokens.**
- **Per-user invite tokens.** 32 random bytes; only the SHA-256 is stored. A token works until the user is disabled (`disabled = 1`), and each request does one indexed D1 read, so revoking is immediate.

## Gotchas

- The `ai` binding is remote-only. `wrangler dev` uses the real model and your free allocation;
  tests mock it and use `remoteBindings: false`.
- `wrangler dev` fails if `web/dist` is missing: run `npm run build` first.
- `wrangler.jsonc` has a `smoke` environment (no AI or D1 binding) for the browser test only.
  Deploy and migration scripts pass `--env=""` so they always target the top-level environment.
- `APP_VERSION` is `dev` locally; CI sets it to the short commit hash on deploy.
- A new prompt means a new file and a new version string in `src/llm.ts`.
- Unknown and disabled users get the same `401`.
- Tests apply the D1 migrations in `test/apply-migrations.ts`; `user:add` needs `db:migrate:local` first.
