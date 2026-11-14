import { describe, expect, it } from "vitest";
import fr_page from "../ocr/__fixtures__/fr_page.json";
import zh_menu from "../ocr/__fixtures__/zh_menu.json";
import { groupBlocks } from "../../src/lang/blocks.ts";
import type { OcrLine } from "../../src/lang/types.ts";
import { hLine, vLine } from "./helpers.ts";

const fixtureLines = (fx: { items: { text: string; poly: number[][] }[] }): OcrLine[] =>
  fx.items.map((i) => ({ text: i.text, poly: i.poly as OcrLine["poly"] }));

describe("groupBlocks on real OCR output", () => {
  it("puts a book page's paragraph text in one block, apart from the title", () => {
    const lines = fixtureLines(fr_page);
    const { blocks, blockOf } = groupBlocks(lines);
    expect(blockOf[0]).not.toBe(blockOf[1]); // title vs body
    expect(blocks.find((b) => b.includes(1))).toEqual(Array.from({ length: 21 }, (_, k) => k + 1));
  });

  it("keeps a menu's dish column apart from its price column and the next dish column", () => {
    const lines = fixtureLines(zh_menu);
    const { blockOf } = groupBlocks(lines);
    expect(blockOf[0]).toBe(blockOf[5]); // 豆豉鲮鱼油麦菜 and 尖椒肉丝, same column
    expect(blockOf[0]).not.toBe(blockOf[1]); // dish vs its price (14元)
    expect(blockOf[0]).not.toBe(blockOf[2]); // dish vs the next column's dish (红烧排骨)
  });
});

describe("groupBlocks on constructed layouts", () => {
  it("splits two side-by-side columns even when OCR interleaves their lines", () => {
    const lines = [
      hLine("left one", 100, 100, 200),
      hLine("right one", 500, 102, 200),
      hLine("left two", 100, 134, 200),
      hLine("right two", 500, 136, 200),
    ];
    const { blocks } = groupBlocks(lines);
    expect(blocks).toHaveLength(2);
    expect(blocks).toEqual(expect.arrayContaining([[0, 2], [1, 3]]));
  });

  it("returns a block's lines top to bottom whatever the OCR order", () => {
    const lines = [hLine("second", 100, 134, 200), hLine("first", 100, 100, 200), hLine("third", 100, 168, 200)];
    expect(groupBlocks(lines).blocks).toEqual([[1, 0, 2]]);
  });

  it("starts a new block after a large vertical gap", () => {
    const lines = [hLine("para one", 100, 100, 200), hLine("para two", 100, 220, 200)];
    expect(groupBlocks(lines).blocks).toHaveLength(2);
  });

  it("separates headings from body text of a different size", () => {
    const lines = [hLine("TITLE", 100, 100, 200, 60), hLine("body text", 100, 162, 200, 30)];
    expect(groupBlocks(lines).blocks).toHaveLength(2);
  });

  it("lets a short last line join the paragraph", () => {
    const lines = [hLine("a long first line", 100, 100, 600), hLine("rouge.", 100, 134, 80)];
    expect(groupBlocks(lines).blocks).toEqual([[0, 1]]);
  });

  it("reads vertical columns from right to left", () => {
    const lines = [vLine("left col", 260, 100, 300), vLine("right col", 300, 100, 300)];
    expect(groupBlocks(lines).blocks).toEqual([[1, 0]]);
  });

  it("never mixes vertical and horizontal lines", () => {
    const lines = [vLine("tall", 100, 100, 300), hLine("wide", 140, 100, 300)];
    expect(groupBlocks(lines).blocks).toHaveLength(2);
  });

  it("handles no lines", () => {
    expect(groupBlocks([])).toEqual({ blocks: [], blockOf: [] });
  });
});
