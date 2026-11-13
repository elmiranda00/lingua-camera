# web

## Purpose

The phone app: React + Vite, built to static files that the Worker serves. Today it's a
placeholder home page; M1 turns it into the camera.

## How it works

1. The browser loads `index.html` and one JS bundle from the Worker. Nothing comes from any other origin.
2. `main.tsx` first imports `shared/browser-setup` (turns off Zod's `eval` probe), then mounts `App`.
3. `App` creates the router. The router matches the URL, runs that route's loader, then renders the page.
4. A loader calls the API client, which calls `/api/*`, validates the reply with a `shared` schema,
   and throws a typed error on any failure.
5. A page that fails to load shows the route's error page instead of a blank screen.

## Key files

| File | Role |
| --- | --- |
| `src/main.tsx` | Entry point |
| `src/App.tsx` | Creates the browser router |
| `src/routes.tsx` | Route table: loader, loading page and error page per route |
| `src/pages/` | `Home`, `NotFound`, `Loading`, `RouteError`, `homeLoader` |
| `src/api/client.ts` | API client: validation, typed errors, 10 s timeout, request-ID logging |
| `vite.config.ts` | Build to `dist/`; in dev, forwards `/api` to the local Worker |
| `test/` | Unit tests, mirroring `src/` |
| `test/e2e/smoke.spec.ts` | Browser smoke test: loads the built app through the Worker, fails on CSP violations, errors or other origins |

## Interfaces

| Route | Page |
| --- | --- |
| `/` | Home: shows the API version |
| `*` | Page not found |

API client (`src/api/client.ts`): `api.getHealth()`. Errors are `ApiRequestError` with
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

Planned for M1, not installed yet:

| Package | Licence | Why |
| --- | --- | --- |
| @paddleocr/paddleocr-js | Apache-2.0 | On-phone OCR |
| clipper-lib | Boost Software License 1.0 | Transitive via paddleocr-js. Permissive; accepted as an exception to the MIT/Apache/BSD preference |
| onnxruntime-web, @techstark/opencv-js | MIT, Apache-2.0 | Transitive via paddleocr-js |
| pinyin-pro | MIT | Pinyin for Chinese |
| vite-plugin-pwa | MIT | Service worker that caches the OCR models |

## Design choices

- **Data router with per-route loaders and error pages**, so data loading and failure handling live in one place.
- **Every API response is validated** against a `shared` schema; failures are logged with the request ID only.
- **Zod runs without `eval`** because the CSP forbids it. `browser-setup` must stay the first import in `main.tsx`.

## Gotchas

- A loader blocks the page until it finishes (up to the 10 s timeout). Don't make the M1 camera route wait on an API call.
- `npm run dev` needs a Cloudflare login, because the Worker's AI binding is remote.
- The Worker only serves what's in `web/dist`; build before `wrangler dev` or deploy.
- Check layouts at 375 px wide.
