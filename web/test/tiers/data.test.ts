import { describe, expect, it } from "vitest";
import fr from "../../src/tiers/data/fr-common.json";
import zh from "../../src/tiers/data/zh-hsk12.json";

describe("word list data", () => {
  it("has the expected size (rebuild with npm run wordlists if a source changes)", () => {
    expect(fr.length).toBeGreaterThan(15000);
    expect(zh.length).toBe(1256);
  });

  it("holds lower-case, NFC French forms without duplicates", () => {
    expect(new Set(fr).size).toBe(fr.length);
    for (const form of fr) {
      expect(form).toBe(form.normalize("NFC").toLowerCase());
    }
  });

  it("includes everyday words and leaves out rare ones", () => {
    const set = new Set(fr);
    for (const w of ["maison", "être", "mangeaient", "aujourd'hui"]) expect(set.has(w)).toBe(true);
    for (const w of ["jonche", "bourgeon", "dépouilles"]) expect(set.has(w)).toBe(false);
  });

  it("holds NFC Chinese words without duplicates", () => {
    expect(new Set(zh).size).toBe(zh.length);
    for (const w of zh) expect(w).toBe(w.normalize("NFC"));
    expect(zh).toContain("谢谢");
    expect(zh).not.toContain("排骨");
  });
});
