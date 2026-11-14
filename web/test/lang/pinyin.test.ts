import { describe, expect, it } from "vitest";
import { pinyinFor } from "../../src/lang/pinyin.ts";

describe("pinyinFor", () => {
  it("gives tone marks", async () => {
    expect(await pinyinFor("出口")).toBe("chū kǒu");
  });

  it("reads a whole word, so a character with several readings follows its word", async () => {
    expect(await pinyinFor("银行")).toBe("yín háng");
    expect(await pinyinFor("行走")).toBe("xíng zǒu");
  });

  it("keeps Latin text and digits together in mixed words", async () => {
    expect(await pinyinFor("A4纸")).toBe("A4 zhǐ");
  });

  it("returns null without Han characters, without loading anything", async () => {
    expect(await pinyinFor("Hello")).toBeNull();
    expect(await pinyinFor("12")).toBeNull();
  });
});
