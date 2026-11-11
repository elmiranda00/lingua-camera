# shared

## Purpose

The API contract: Zod schemas and types for every request and response, plus the
request limits. Both `web` and `worker` import from here, so the contract is defined once.

## How it works

1. Each endpoint's request and response is a Zod schema in `src/schemas.ts`.
2. The Worker parses every request body with the matching schema and returns `400` if it fails.
3. The Worker parses every model reply with `LookupResult` before using it.
4. The web app parses every response, so a contract mismatch fails loudly instead of rendering bad data.
5. TypeScript types come from the schemas (`z.infer`), so there's no separate type to keep in sync.

## Key files

| File | Role |
| --- | --- |
| `src/schemas.ts` | Zod schemas: `Lang`, `ApiError`, `Health`, `LookupRequest`, `LookupResult`, `LookupResponse`, `TtsRequest` |
| `src/limits.ts` | Numbers from the spec's limits table (lengths, body size, daily caps) |
| `src/index.ts` | Public exports |

## Interfaces

Import everything from `@lexi/shared`:

```ts
import { LookupRequest, LIMITS, type LookupResult } from "@lexi/shared";
```

The package ships TypeScript source (no build step); Vite and Wrangler compile it.

## Running and testing

```
npx vitest run --project shared
npm run typecheck -w @lexi/shared
```

## Gotchas

- Changing a schema changes the API contract for both sides. If a change affects
  stored data or the model prompt, note it in `docs/DECISIONS.md`.
- `worker/src/limits.ts` re-exports `LIMITS`; change the values here.
