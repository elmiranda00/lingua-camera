import { describe, expect, it } from "vitest";
import { zh } from "../../src/lang/zh.ts";

const ctx = { sentenceStart: false };

describe("zh.segment", () => {
  it("splits a sentence into words", () => {
    const words = zh.segment("我喜欢苹果").filter((w) => w.wordLike).map((w) => w.text);
    expect(words.join("")).toBe("我喜欢苹果");
    expect(words.length).toBeGreaterThan(1);
  });

  it("separates numbers and punctuation", () => {
    const parts = zh.segment("出口，14元");
    expect(parts.filter((p) => !p.wordLike).map((p) => p.text)).toEqual(["，"]);
    expect(parts.find((p) => p.text === "14")?.wordLike).toBe(true);
  });

  it("gives offsets into the line text", () => {
    const text = "欢迎光临北京烤鸭店";
    for (const w of zh.segment(text)) expect(text.slice(w.start, w.end)).toBe(w.text);
  });
});

describe("zh.splitLineBoxes", () => {
  it("gives every Han character an equal share", () => {
    const poly: [number, number][] = [[0, 0], [400, 0], [400, 50], [0, 50]];
    const boxes = zh.splitLineBoxes({ text: "出口在左边", poly: poly });
    expect(boxes.map((b) => b.text).join("")).toBe("出口在左边");
    const widths = boxes.map((b) => (b.quad[1][0] - b.quad[0][0]) / b.text.length);
    for (const w of widths) expect(w).toBeCloseTo(80, 5);
  });

  it("gives digits less room than Han characters in mixed text", () => {
    const poly: [number, number][] = [[0, 0], [255, 0], [255, 50], [0, 50]];
    const boxes = zh.splitLineBoxes({ text: "16元", poly });
    const [num, yuan] = boxes;
    expect(num!.text).toBe("16");
    expect(num!.quad[1][0] - num!.quad[0][0]).toBeCloseTo((255 * 1.1) / 2.1, 5); // 2 digits (0.55 each) of 2.1 units
    expect(yuan!.quad[1][0] - yuan!.quad[0][0]).toBeGreaterThan((num!.quad[1][0] - num!.quad[0][0]) / 2); // per character
  });

  it("splits vertical lines top to bottom", () => {
    const poly: [number, number][] = [[10, 0], [50, 0], [50, 400], [10, 400]];
    const boxes = zh.splitLineBoxes({ text: "出口在外", poly });
    expect(boxes.map((b) => b.text).join("")).toBe("出口在外");
    const tops = boxes.map((b) => b.quad[0][1]);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    expect(boxes[0]!.quad[0][1]).toBe(0);
    expect(boxes.at(-1)!.quad[2][1]).toBe(400);
    for (const b of boxes) expect(b.quad[1][0] - b.quad[0][0]).toBe(40);
  });
});

describe("zh.isKeyWord", () => {
  it("is false for HSK 1-2 words", () => {
    for (const w of ["你", "谢谢", "鸡蛋", "米饭"]) expect(zh.isKeyWord(w, ctx)).toBe(false);
  });

  it("is true for words above HSK 2", () => {
    for (const w of ["红烧", "排骨", "腰花"]) expect(zh.isKeyWord(w, ctx)).toBe(true);
  });

  it("is false for numbers, Latin text and punctuation", () => {
    for (const w of ["14", "WIFI", "，", "OK"]) expect(zh.isKeyWord(w, ctx)).toBe(false);
  });
});

describe("zh matching, collation and speech", () => {
  it("matches the exact written word", () => {
    expect(zh.normalizeForMatch(" 出口 ")).toBe("出口");
  });

  it("sorts by pinyin", () => {
    expect(["上海", "北京", "安徽"].sort(zh.collator.compare)).toEqual(["安徽", "北京", "上海"]);
  });

  it("speaks zh-CN", () => {
    expect(zh.speechLang).toBe("zh-CN");
  });
});
