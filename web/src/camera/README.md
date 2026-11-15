# camera

## Purpose

The pieces of the camera page: live viewfinder, taking a photo, showing it with tappable word boxes, zoom.

## How it works

1. The page opens with a black box and the app glyph (`StartCamera`); the camera is off. Tapping it starts `Viewfinder`, which asks for the rear camera. If that is blocked or missing, the page shows "Take photo" and "Choose from gallery" instead. After Retake the viewfinder comes straight back.
2. The shutter (`captureFrame`) or a picked file becomes a photo. `toOcrBitmap` shrinks it to 1600 px for OCR; the original is shown on screen.
3. The page runs OCR and the tier rules, then `PhotoView` draws one `WordButton` per word over the photo.
4. Each box is a real button, rotated to follow tilted text. Pinch, drag or wheel zoom moves the photo and boxes together.
5. Changing language re-reads the same photo. Retake returns to the viewfinder.

## Key files

| File | Role |
| --- | --- |
| `StartCamera.tsx` | Black box with the app glyph shown before the camera is on |
| `Viewfinder.tsx` | Camera stream; reports ready or unavailable |
| `PhotoView.tsx`, `useZoom.ts`, `zoom.ts` | Photo, boxes, pinch and drag; the math is in `zoom.ts` |
| `WordButton.tsx`, `geometry.ts` | One word box; quad → rotated rectangle, photo sizing |
| `photo.ts` | Frame capture and downscaling |
| `LangChip.tsx`, `settings.ts` | Language switch, remembered in `localStorage` |
| `PhotoPickers.tsx` | Gallery and "Take photo" fallback |
| `ModelStatus.tsx`, `hooks.ts` | First-run download banner; small hooks |
| `camera.css` | Layout and the three box styles |

## Interfaces

Used only by `src/pages/Camera.tsx`, which also owns the translation sheet (`src/lookup/`). Boxes come from `src/tiers`; OCR from `src/ocr`.

## Running and testing

Unit tests: `web/test/camera` (geometry, zoom). The browser smoke test covers the whole page.

## Design choices

- **Box styles by tier:** Saved grey fill, Key thicker orange rounded outline (thickness follows box size so dense text stays readable), Normal thin light outline.
- **Boxes are real buttons** with labels (word, and "key word" or "saved"), keyboard focusable.
- **The camera starts only on a tap,** so opening the app never triggers a permission prompt.
- **The camera route has no loader,** so it shows at once. The API version moved to `/about`.
- **Gestures use pointer events,** with a 6 px threshold so a tap on a box isn't mistaken for a drag.
- **Language is remembered per phone** and defaults to French.

## Gotchas

- `getUserMedia` needs HTTPS (or localhost). On a phone, test on the deployed URL.
- In-app browsers (WeChat and others) may block the live camera; the file inputs are the fallback.
- Curved pages lose words: the detector reads straight lines best, so photograph pages as flat as possible.
- Dense text (menus) gives crowded, overlapping boxes, mostly from `Intl.Segmenter` cutting phrases into short pieces. Candidate fixes: skip stop words, merge short neighbours.
- Tapping a box highlights it and opens the translation sheet (`src/lookup/`). The sheet covers the lower part of the photo.
- The key-word outline size is set per box with a CSS variable; keep it when restyling.
