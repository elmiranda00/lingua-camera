import { describe, expect, it } from "vitest";
import { fr } from "../../src/lang/fr.ts";

const words = (text: string) => fr.segment(text).filter((w) => w.wordLike).map((w) => w.text);
const ctx = { sentenceStart: false };

describe("fr.segment", () => {
  it("splits elisions into their own token", () => {
    expect(words("l'homme")).toEqual(["l'", "homme"]);
    expect(words("qu’ils s’entretuent")).toEqual(["qu’", "ils", "s’", "entretuent"]);
    expect(words("jusqu'ici")).toEqual(["jusqu'", "ici"]);
  });

  it("keeps words with an apostrophe inside whole", () => {
    expect(words("aujourd'hui")).toEqual(["aujourd'hui"]);
    expect(words("quelqu'un")).toEqual(["quelqu'un"]);
  });

  it("keeps hyphenated compounds whole", () => {
    expect(words("un porte-monnaie")).toEqual(["un", "porte-monnaie"]);
    expect(words("peut-être")).toEqual(["peut-être"]);
  });

  it("leaves a trailing hyphen out of the word", () => {
    expect(words("extra-")).toEqual(["extra"]);
  });

  it("gives offsets into the line text", () => {
    const text = "Il n'est pas";
    for (const w of fr.segment(text)) expect(text.slice(w.start, w.end)).toBe(w.text);
  });

  it("marks punctuation as not word-like", () => {
    expect(fr.segment("oui,").map((w) => w.wordLike)).toEqual([true, false]);
  });
});

describe("fr.splitLineBoxes", () => {
  it("makes one box per word, in order, inside the line", () => {
    const poly: [number, number][] = [[0, 0], [1000, 0], [1000, 50], [0, 50]];
    const boxes = fr.splitLineBoxes({ text: "Voilà tout un hiver", poly });
    expect(boxes.map((b) => b.text)).toEqual(["Voilà", "tout", "un", "hiver"]);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.quad[0][0]).toBeGreaterThanOrEqual(boxes[i - 1]!.quad[1][0]);
    expect(boxes[0]!.quad[0][0]).toBeGreaterThanOrEqual(0);
    expect(boxes.at(-1)!.quad[1][0]).toBeLessThanOrEqual(1000);
  });

  it("gives narrow letters less room than wide ones", () => {
    const poly: [number, number][] = [[0, 0], [1000, 0], [1000, 50], [0, 50]];
    const [narrow, wide] = fr.splitLineBoxes({ text: "ili mom", poly });
    expect(narrow!.quad[1][0] - narrow!.quad[0][0]).toBeLessThan(wide!.quad[1][0] - wide!.quad[0][0]);
  });
});

describe("fr.normalizeForMatch", () => {
  it("lower-cases, normalises Unicode and strips punctuation", () => {
    expect(fr.normalizeForMatch("Hiver,")).toBe("hiver");
    expect(fr.normalizeForMatch("« Cœur »")).toBe("cœur");
    expect(fr.normalizeForMatch("été")).toBe("été"); // decomposed accents
  });

  it("strips an elision prefix and unifies apostrophes", () => {
    expect(fr.normalizeForMatch("l’homme")).toBe("homme");
    expect(fr.normalizeForMatch("qu'ils")).toBe("ils");
    expect(fr.normalizeForMatch("aujourd’hui")).toBe("aujourd'hui");
  });

  it("returns nothing for a bare elision prefix", () => {
    expect(fr.normalizeForMatch("l'")).toBe("");
  });
});

describe("fr.isKeyWord", () => {
  it("is false for common words and their inflections", () => {
    for (const w of ["maison", "guerre", "lumière", "mangeaient", "être", "à"]) expect(fr.isKeyWord(w, ctx)).toBe(false);
  });

  it("is true for less common words", () => {
    for (const w of ["jonche", "dépouilles", "bourgeon", "sève"]) expect(fr.isKeyWord(w, ctx)).toBe(true);
  });

  it("ignores case and elision when looking up", () => {
    expect(fr.isKeyWord("GUERRE", ctx)).toBe(false);
    expect(fr.isKeyWord("l'", ctx)).toBe(false);
    expect(fr.isKeyWord("l'homme", ctx)).toBe(false);
    expect(fr.isKeyWord("l'enfouis", ctx)).toBe(true);
  });

  it("treats a capitalised word inside a sentence as a name", () => {
    expect(fr.isKeyWord("Bourgeon", { sentenceStart: false })).toBe(false);
    expect(fr.isKeyWord("Bourgeon", { sentenceStart: true })).toBe(true);
  });

  it("does not treat ALL CAPS as a name", () => {
    expect(fr.isKeyWord("PROLOGUE", ctx)).toBe(true);
  });

  it("is false for numbers and symbols", () => {
    for (const w of ["13", "2024", "%"]) expect(fr.isKeyWord(w, ctx)).toBe(false);
  });

  it("counts a hyphenated compound as common when every part is", () => {
    expect(fr.isKeyWord("dit-il", ctx)).toBe(false);
    expect(fr.isKeyWord("porte-bourgeon", ctx)).toBe(true);
  });
});

describe("fr collation and speech", () => {
  it("sorts with French rules (plain letters before accented, accents compared left to right)", () => {
    const sorted = ["côte", "cote", "coté", "côté"].sort(fr.collator.compare);
    expect(sorted).toEqual(["cote", "coté", "côte", "côté"]);
    expect(["été", "zèbre", "abri"].sort(fr.collator.compare)).toEqual(["abri", "été", "zèbre"]);
  });

  it("speaks fr-FR", () => {
    expect(fr.speechLang).toBe("fr-FR");
  });
});
