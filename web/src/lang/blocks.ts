// Groups OCR lines into text blocks (paragraphs, columns, signs), in reading order
//
// Works in a reading frame: u runs along the line, v runs to the next line
// (horizontal: u = x, v = y down; vertical text: u = y, v = -x, so columns go right to left)
import { isVertical, toQuad } from "./lineBoxes.ts";
import type { OcrLine, Point } from "./types.ts";

// Tuning: how close two lines must be to share a block
const MIN_OVERLAP = 0.3; // share of the shorter line that must sit beside the other
const MAX_SIZE_RATIO = 1.5; // text size (line thickness) may differ by this factor
const MAX_GAP = 0.8; // gap to the next line, in line thicknesses
const MAX_OVERLAP_DEPTH = 0.5; // lines may overlap this much (tilted pages), more means side by side

interface Frame {
  vertical: boolean;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  thickness: number;
}

const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function frameOf(line: OcrLine): Frame {
  const quad = toQuad(line.poly);
  const vertical = isVertical(quad);
  const us = quad.map(([x, y]) => (vertical ? y : x));
  const vs = quad.map(([x, y]) => (vertical ? -x : y));
  return {
    vertical,
    u0: Math.min(...us),
    u1: Math.max(...us),
    v0: Math.min(...vs),
    v1: Math.max(...vs),
    thickness: vertical ? dist(quad[0], quad[1]) : dist(quad[0], quad[3]),
  };
}

function sameBlock(a: Frame, b: Frame): boolean {
  if (a.vertical !== b.vertical) return false;
  const thin = Math.min(a.thickness, b.thickness);
  if (thin <= 0 || Math.max(a.thickness, b.thickness) > MAX_SIZE_RATIO * thin) return false;

  const overlap = Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0);
  const shorter = Math.min(a.u1 - a.u0, b.u1 - b.u0);
  if (shorter <= 0 || overlap < MIN_OVERLAP * shorter) return false;

  const gap = b.v0 - a.v1; // b is the later line
  return gap <= MAX_GAP * thin && gap >= -MAX_OVERLAP_DEPTH * thin;
}

/** Blocks as lists of line indexes, each in reading order; `blockOf[i]` is line i's block. */
export function groupBlocks(lines: OcrLine[]): { blocks: number[][]; blockOf: number[] } {
  const frames = lines.map(frameOf);
  const centre = (i: number) => (frames[i]!.v0 + frames[i]!.v1) / 2;
  const order = lines.map((_, i) => i).sort((i, j) => centre(i) - centre(j) || frames[i]!.u0 - frames[j]!.u0);

  // Union-find over lines that sit directly after one another
  const parent = lines.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let x = 0; x < order.length; x++) {
    for (let y = x + 1; y < order.length; y++) {
      const i = order[x]!;
      const j = order[y]!;
      if (sameBlock(frames[i]!, frames[j]!)) parent[find(j)] = find(i);
    }
  }

  const byRoot = new Map<number, number[]>();
  for (const i of order) {
    const root = find(i);
    byRoot.set(root, [...(byRoot.get(root) ?? []), i]);
  }
  const blocks = [...byRoot.values()];
  const blockOf = new Array<number>(lines.length).fill(0);
  blocks.forEach((block, b) => block.forEach((i) => (blockOf[i] = b)));
  return { blocks, blockOf };
}
