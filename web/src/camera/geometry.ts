// Pure geometry for the photo view
import type { Quad } from "../lang/types.ts";

// Longest side of the image sent to OCR (spec: 1600 px)
export const OCR_MAX_SIDE = 1600;

// Size that fits within max on the long side; never upscales
export function fitSize(width: number, height: number, max = OCR_MAX_SIDE): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const k = max / long;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

export interface CssBox {
  left: number;
  top: number;
  width: number;
  height: number;
  angle: number; // degrees, rotate about the top-left corner
}

// A word quad as an absolutely positioned, rotated rectangle (px = image px * scale)
export function quadToCss(quad: Quad, scale: number): CssBox {
  const [tl, tr, , bl] = quad;
  return {
    left: tl[0] * scale,
    top: tl[1] * scale,
    width: Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) * scale,
    height: Math.hypot(bl[0] - tl[0], bl[1] - tl[1]) * scale,
    angle: (Math.atan2(tr[1] - tl[1], tr[0] - tl[0]) * 180) / Math.PI,
  };
}
