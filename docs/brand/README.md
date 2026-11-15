# brand

## Purpose

Master copies of the Lingua Camera logo. Not served: the app uses copies made from these.

## How it works

1. `app-icon.svg` is the source for every app icon. `node scripts/make-icons.mjs` renders it to
   `web/public/icon.svg` (favicon) and the PNGs the manifest and iOS need.
2. The glyph on dark screens (welcome page, camera start box) is drawn inline by
   `web/src/brand/Glyph.tsx`, copied from `glyph-dark-bg.svg`.

## Key files

| File | Role |
| --- | --- |
| `app-icon.svg` | Home-screen and browser icon (ink-blue tile) |
| `glyph-dark-bg.svg` | Glyph only, for dark screens |
| `glyph-light-bg.svg` | Glyph only, for light screens |
| `app-icon-mono-white.svg`, `glyph-mono-black.svg` | One-colour versions |

## Design choices

- **Colours:** Ink Blue `#1B2B5E` · Teal `#20D8B5` · White `#FFFFFF` · Welcome background `#071527`.
- **Wordmark:** "Lingua" Space Grotesk 700 in teal, "Camera" Space Grotesk 400, glyph to the left
  (gap ≈ 0.44 × font size, glyph ≈ 1.75 × font size).
- **Icon PNGs are generated, not exported by hand,** so one SVG change updates every size.

## Gotchas

- After changing `app-icon.svg` or `glyph-dark-bg.svg`, rerun `make-icons.mjs` and update `Glyph.tsx` to match.
- Installed home-screen icons only refresh when the phone re-reads the manifest; re-adding the app is the quick way.
