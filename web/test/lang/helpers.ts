// Builds OCR lines and word references for the block and sentence tests
import { getLang } from "../../src/lang/index.ts";
import type { WordRef } from "../../src/lang/context.ts";
import type { OcrLine, Point } from "../../src/lang/types.ts";

/** A horizontal line whose top-left corner is (x, y). */
export function hLine(text: string, x: number, y: number, w: number, h = 30): OcrLine {
  const poly: Point[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return { text, poly };
}

/** A vertical line (top to bottom) whose top-left corner is (x, y). */
export function vLine(text: string, x: number, y: number, h: number, w = 30): OcrLine {
  const poly: Point[] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  return { text, poly };
}

/** Where the first word box with this text sits on the given line. */
export function wordRef(lines: OcrLine[], lang: "fr" | "zh", line: number, word: string): WordRef {
  const box = getLang(lang).splitLineBoxes(lines[line]!).find((b) => b.text === word);
  if (!box) throw new Error(`No word "${word}" on line ${line}`);
  return { line, start: box.start, end: box.end };
}
