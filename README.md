# lingua-camera

Phone web app: photograph a page or sign, tap a word, see its English meaning in context
(plus pinyin for Chinese), hear it, and save it to a personal word bank.
French → English and Mandarin (Simplified) → English. For up to 10 invited users; runs free on Cloudflare.

## Status

M0 (scaffold) and M1 (photo to word boxes) are done. M2 (tap a word, see its meaning) is built and
waiting for its phone checks. Audio, saving words and the word bank are M3. See
[docs/SPEC.md](docs/SPEC.md) for the plan and the acceptance checklist.

## Quick start

Needs Node 24 (see `.nvmrc`) and a free Cloudflare account.

```
npm install
npx wrangler login      # once; the Worker's AI binding needs it
npm run db:migrate:local                 # once: create the local database
npm run user:add -- "Your name"         # prints an invite link; open it in the browser to sign in
npm run dev             # Worker + web app together
```

Every API call needs a signed-in user. `user:add` prints a link like `http://localhost:5173/join#<token>`; opening it
signs that browser in. For the live app, add `--remote` (creates the user in the production database).

| Command | What it does |
| --- | --- |
| `npm run test` | Unit tests, all packages |
| `npm run test:e2e` | Browser smoke test (builds first) |
| `npm run typecheck` / `npm run lint` | Type and lint checks |
| `npm run assets` | Download OCR models (hash-checked) and runtime files into `web/public` (dev and build run it) |
| `npm run wordlists` | Rebuild the tier word lists in `web/src/tiers/data` from pinned sources |
| `npm run user:add -- "Name" [--remote]` | Create a user and print their invite link (shown once) |
| `npm run p50 -- tail.log` | Lookup latency (p50, p95) from `npx wrangler tail --format json > tail.log` |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply D1 migrations |
| `npm run build` | Build the web app to `web/dist` |
| `npm run deploy` | Build, then deploy Worker and web app (CI normally does this) |

## Layout

| Folder | What's in it |
| --- | --- |
| [web/](web/README.md) | React app |
| [worker/](worker/README.md) | Cloudflare Worker: API, D1 migrations, prompts |
| [shared/](shared/README.md) | Zod schemas and limits used by both |
| [docs/](docs/) | `SPEC.md` (the plan), `DECISIONS.md` (structural decisions) |

Everything the browser loads comes from our own origin: no CDNs, fonts or analytics.

## Licence

Apache-2.0. See [LICENSE](LICENSE).
