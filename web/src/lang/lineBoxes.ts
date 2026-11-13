// Splits a line's quad into word quads, sharing the line's length by estimated character widths
import type { OcrLine, Point, Quad, Word, WordBox } from "./types.ts";

const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// The detector returns a 4-point box; anything else falls back to the bounding rectangle
export function toQuad(poly: Point[]): Quad {
  if (poly.length === 4) return poly as Quad;
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

// Tall and narrow lines (height > 2x width) are vertical text, read top to bottom
export function isVertical(quad: Quad): boolean {
  return dist(quad[0], quad[3]) > 2 * dist(quad[0], quad[1]);
}

// The part of the quad between fractions a and b along the reading direction
export function sliceQuad(quad: Quad, a: number, b: number, vertical: boolean): Quad {
  const [tl, tr, br, bl] = quad;
  if (vertical) return [lerp(tl, bl, a), lerp(tr, br, a), lerp(tr, br, b), lerp(tl, bl, b)];
  return [lerp(tl, tr, a), lerp(tl, tr, b), lerp(bl, br, b), lerp(bl, br, a)];
}

export function boxesForWords(words: Word[], line: OcrLine, charWidth: (ch: string) => number): WordBox[] {
  const quad = toQuad(line.poly);
  const vertical = isVertical(quad);
  // Cumulative width before each UTF-16 index
  const before = new Array<number>(line.text.length + 1).fill(0);
  let total = 0;
  let index = 0;
  for (const ch of line.text) {
    for (let k = 0; k < ch.length; k++) before[index + k] = total;
    total += charWidth(ch);
    index += ch.length;
    before[index] = total;
  }
  if (total === 0) return [];
  return words.map((w) => ({
    ...w,
    quad: sliceQuad(quad, before[w.start]! / total, before[w.end]! / total, vertical),
  }));
}
