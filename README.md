# lingua-camera

Phone web app: photograph a page or sign, tap a word, see its English meaning in context
(plus pinyin for Chinese), hear it, and save it to a personal word bank.
French → English and Mandarin (Simplified) → English. For up to 10 invited users; runs free on Cloudflare.

## Status

Milestone 0 (scaffold) is in progress. The app is a placeholder home page backed by a working
API; camera and OCR come in M1. See [docs/SPEC.md](docs/SPEC.md) for the plan and milestones.

## Quick start

Needs Node 24 (see `.nvmrc`) and a free Cloudflare account.

```
npm install
npx wrangler login      # once; the Worker's AI binding needs it
npm run dev             # Worker + web app together
```

| Command | What it does |
| --- | --- |
| `npm run test` | Unit tests, all packages |
| `npm run test:e2e` | Browser smoke test (builds first) |
| `npm run typecheck` / `npm run lint` | Type and lint checks |
| `npm run assets` | Download OCR models (hash-checked) and runtime files into `web/public` (dev and build run it) |
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
