import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fr } from "../../src/lang/fr.ts";
import { isVertical } from "../../src/lang/lineBoxes.ts";
import type { OcrLine, Quad } from "../../src/lang/types.ts";
import { zh } from "../../src/lang/zh.ts";
import { tierBoxes } from "../../src/tiers/tiers.ts";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../ocr/__fixtures__/${name}.json`, import.meta.url), "utf8")) as {
    image: { width: number; height: number };
    items: OcrLine[];
  };

const line = (text: string, y = 0): OcrLine => ({
  text,
  poly: [[0, y], [1000, y], [1000, y + 40], [0, y + 40]],
});
const tiersOf = (lines: OcrLine[], saved?: Set<string>) =>
  Object.fromEntries(tierBoxes(lines, fr, saved).map((b) => [b.text, b.tier]));

describe("tierBoxes", () => {
  it("marks rare words key and common words normal", () => {
    expect(tiersOf([line("la guerre jonche le sol")])).toEqual({
      la: "normal",
      guerre: "normal",
      jonche: "key",
      le: "normal",
      sol: "normal",
    });
  });

  it("saved takes priority over key", () => {
    const saved = new Set([fr.normalizeForMatch("jonche")]);
    expect(tiersOf([line("la guerre jonche")], saved).jonche).toBe("saved");
  });

  it("matches saved words after normalisation (case, elision)", () => {
    const saved = new Set(["bourgeon"]);
    const tiers = tierBoxes([line("Le Bourgeon et l'bourgeon")], fr, saved).filter((b) => b.tier === "saved");
    expect(tiers.map((b) => b.text)).toEqual(["Bourgeon", "bourgeon"]);
  });

  it("treats a capitalised rare word as a name mid-sentence but not at a sentence start", () => {
    const tiers = tierBoxes([line("Il voit Bourgeon. Bourgeon dort")], fr);
    expect(tiers.filter((b) => b.text === "Bourgeon").map((b) => b.tier)).toEqual(["normal", "key"]);
  });

  it("carries the sentence start across line breaks", () => {
    const wrapped = tierBoxes([line("Il voit la fin.", 0), line("Bourgeon dort", 50)], fr);
    expect(wrapped.find((b) => b.text === "Bourgeon")!.tier).toBe("key"); // new sentence
    const midSentence = tierBoxes([line("Il voit la fin de", 0), line("Bourgeon dort", 50)], fr);
    expect(midSentence.find((b) => b.text === "Bourgeon")!.tier).toBe("normal"); // a name
  });

  it("starts a page with a sentence start", () => {
    expect(tierBoxes([line("Bourgeon dort")], fr)[0]!.tier).toBe("key");
  });

  it("records which line a box came from", () => {
    const boxes = tierBoxes([line("un", 0), line("deux", 50)], fr);
    expect(boxes.map((b) => b.line)).toEqual([0, 1]);
  });

  it("uses the language module's rules (Chinese)", () => {
    const tiers = Object.fromEntries(tierBoxes([line("红烧排骨 28元")], zh).map((b) => [b.text, b.tier]));
    expect(tiers["28"]).toBe("normal");
    expect(Object.values(tiers)).toContain("key");
  });
});

describe("tiers on real OCR output", () => {
  const page = fixture("fr_page");
  const boxes = tierBoxes(page.items, fr);

  it("marks the rare words of the French page key", () => {
    const key = boxes.filter((b) => b.tier === "key").map((b) => b.text);
    for (const w of ["jonche", "dépouilles", "bourgeon", "sève", "PROLOGUE"]) expect(key).toContain(w);
  });

  it("leaves ordinary words normal, with elisions split", () => {
    const normal = boxes.filter((b) => b.tier === "normal").map((b) => b.text);
    for (const w of ["guerre", "lumière", "corps", "n'", "s'", "13"]) expect(normal).toContain(w);
  });

  it("gives a box to every word-like token on the page", () => {
    const expected = page.items.flatMap((l) => fr.segment(l.text).filter((w) => w.wordLike)).length;
    expect(boxes.length).toBe(expected);
  });

  it("keeps every box inside its line's bounding box", () => {
    for (const b of boxes) {
      const poly = page.items[b.line]!.poly;
      const [minX, maxX] = [Math.min(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[0]))];
      const [minY, maxY] = [Math.min(...poly.map((p) => p[1])), Math.max(...poly.map((p) => p[1]))];
      for (const [x, y] of b.quad) {
        expect(x).toBeGreaterThanOrEqual(minX - 1e-6);
        expect(x).toBeLessThanOrEqual(maxX + 1e-6);
        expect(y).toBeGreaterThanOrEqual(minY - 1e-6);
        expect(y).toBeLessThanOrEqual(maxY + 1e-6);
      }
    }
  });

  it("covers the Chinese menu with ordered, non-overlapping boxes on each line", () => {
    const menu = fixture("zh_menu");
    const zhBoxes = tierBoxes(menu.items, zh);
    expect(zhBoxes.length).toBeGreaterThan(menu.items.length);
    expect(zhBoxes.some((b) => b.tier === "key")).toBe(true);
    expect(zhBoxes.some((b) => b.tier === "normal")).toBe(true);
    for (let i = 1; i < zhBoxes.length; i++) {
      const [prev, cur] = [zhBoxes[i - 1]!, zhBoxes[i]!];
      if (prev.line !== cur.line) continue;
      const vertical = isVertical(cur.quad);
      // along the reading direction: x for horizontal lines, y for vertical ones
      const start = (q: Quad) => q[0][vertical ? 1 : 0];
      const end = (q: Quad) => (vertical ? q[3][1] : q[1][0]);
      expect(start(cur.quad)).toBeGreaterThanOrEqual(end(prev.quad) - 1e-6);
    }
  });
});
