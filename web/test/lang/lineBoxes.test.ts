import { describe, expect, it } from "vitest";
import { boxesForWords, isVertical, toQuad } from "../../src/lang/lineBoxes.ts";
import type { OcrLine, Point, Word } from "../../src/lang/types.ts";

const equalWidth = () => 1;
const word = (text: string, start: number): Word => ({ text, start, end: start + text.length, wordLike: true });
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

describe("boxesForWords", () => {
  it("shares a horizontal line by character count", () => {
    const line: OcrLine = { text: "abcdefghij", poly: rect(100, 50, 1000, 40) };
    const [a, b] = boxesForWords([word("abcd", 0), word("fghij", 5)], line, equalWidth);
    expect(a!.quad).toEqual([[100, 50], [500, 50], [500, 90], [100, 90]]);
    expect(b!.quad[0]).toEqual([600, 50]);
    expect(b!.quad[1]).toEqual([1100, 50]);
  });

  it("follows a tilted line", () => {
    // top edge rises 100 px over 1000 px; bottom edge likewise
    const poly: Point[] = [[0, 100], [1000, 0], [1000, 40], [0, 140]];
    const [first] = boxesForWords([word("ab", 0)], { text: "abcd", poly }, equalWidth);
    expect(first!.quad[1]).toEqual([500, 50]);
    expect(first!.quad[2]).toEqual([500, 90]);
  });

  it("splits vertical text from top to bottom", () => {
    const line: OcrLine = { text: "出口在外", poly: rect(10, 0, 40, 400) };
    expect(isVertical(toQuad(line.poly))).toBe(true);
    const [first, second] = boxesForWords([word("出口", 0), word("在外", 2)], line, equalWidth);
    expect(first!.quad).toEqual([[10, 0], [50, 0], [50, 200], [10, 200]]);
    expect(second!.quad[0]).toEqual([10, 200]);
    expect(second!.quad[2]).toEqual([50, 400]);
  });

  it("treats height > 2x width as vertical, not less", () => {
    expect(isVertical(toQuad(rect(0, 0, 40, 81)))).toBe(true);
    expect(isVertical(toQuad(rect(0, 0, 40, 80)))).toBe(false);
  });

  it("uses character widths when given", () => {
    const widths = (ch: string) => (ch === "i" ? 1 : 3);
    const line: OcrLine = { text: "iiWW", poly: rect(0, 0, 800, 10) };
    const [first] = boxesForWords([word("ii", 0)], line, widths);
    expect(first!.quad[1]![0]).toBe(200); // 2 of 8 width units
  });

  it("counts surrogate pairs as one character", () => {
    const line: OcrLine = { text: "𠮷a", poly: rect(0, 0, 200, 10) };
    const [first] = boxesForWords([{ text: "𠮷", start: 0, end: 2, wordLike: true }], line, equalWidth);
    expect(first!.quad[1]![0]).toBe(100);
  });

  it("returns nothing for an empty line", () => {
    expect(boxesForWords([], { text: "", poly: rect(0, 0, 10, 10) }, equalWidth)).toEqual([]);
  });
});

describe("toQuad", () => {
  it("falls back to the bounding rectangle for polygons that are not 4 points", () => {
    const poly: Point[] = [[5, 10], [50, 8], [60, 30], [30, 40], [4, 30]];
    expect(toQuad(poly)).toEqual([[4, 8], [60, 8], [60, 40], [4, 40]]);
  });
});
