import { describe, expect, it } from "vitest";
import fr_page from "../ocr/__fixtures__/fr_page.json";
import zh_menu from "../ocr/__fixtures__/zh_menu.json";
import { createSentenceFinder } from "../../src/lang/context.ts";
import { getLang } from "../../src/lang/index.ts";
import type { OcrLine } from "../../src/lang/types.ts";
import { hLine, vLine, wordRef } from "./helpers.ts";

const fixtureLines = (fx: { items: { text: string; poly: number[][] }[] }): OcrLine[] =>
  fx.items.map((i) => ({ text: i.text, poly: i.poly as OcrLine["poly"] }));

/** Sentence for the first `word` on `line`. */
function sentence(lines: OcrLine[], lang: "fr" | "zh", line: number, word: string, max?: number): string {
  return createSentenceFinder(lines, getLang(lang), max)(wordRef(lines, lang, line, word));
}

describe("sentences on a real French page", () => {
  const lines = fixtureLines(fr_page);

  it("cuts a sentence that starts and ends mid-line", () => {
    expect(sentence(lines, "fr", 1, "lumière")).toBe("La lumière pleut sur ses yeux fermés, sur son corps allongé au cœur arrêté.");
  });

  it("joins a sentence that wraps over several lines", () => {
    expect(sentence(lines, "fr", 7, "pourrait")).toBe("Mais ailleurs, il pourrait être un père, un frère, un ami ou un mari.");
  });

  it("gives the same sentence for every word in it", () => {
    expect(sentence(lines, "fr", 6, "personne")).toBe("Il n'est personne parmi les autres.");
    expect(sentence(lines, "fr", 6, "autres")).toBe("Il n'est personne parmi les autres.");
  });

  it("never reaches into the title block", () => {
    expect(sentence(lines, "fr", 0, "PROLOGUE")).toBe("PROLOGUE PREMIER");
  });
});

describe("sentences on a real Chinese menu", () => {
  const lines = fixtureLines(zh_menu);

  it("sends the dish with the dish above and below, not the whole column", () => {
    expect(sentence(lines, "zh", 5, "肉丝")).toBe("豆豉鲮鱼油麦菜尖椒肉丝鱼香肉丝");
  });

  it("does not pull in the price column or other dish columns", () => {
    const result = sentence(lines, "zh", 5, "肉丝");
    expect(result).not.toMatch(/元|红烧排骨/);
  });
});

describe("French sentence rules", () => {
  const one = (text: string, word: string, max?: number) => sentence([hLine(text, 100, 100, 800)], "fr", 0, word, max);

  it("treats ! ? and … as sentence ends", () => {
    expect(one("Quoi ? Non ! Peut-être… Oui.", "Non")).toBe("Non !");
    expect(one("Quoi ? Non ! Peut-être… Oui.", "Oui")).toBe("Oui.");
  });

  it("does not cut at decimals, web addresses or initials", () => {
    expect(one("Il coûte 3.5 euros. Oui.", "euros")).toBe("Il coûte 3.5 euros.");
    expect(one("Voir www.exemple.fr pour plus. Fin.", "plus")).toBe("Voir www.exemple.fr pour plus.");
    expect(one("Il parle à M. Dupont ici. Fin.", "ici")).toBe("Il parle à M. Dupont ici.");
  });

  it("keeps closing quotes with their sentence", () => {
    const text = "« Viens ici. » Puis il partit.";
    expect(one(text, "ici")).toBe("« Viens ici. »");
    expect(one(text, "partit")).toBe("Puis il partit.");
  });

  it("sends the whole block when there is no punctuation", () => {
    const lines = [hLine("SORTIE DE", 100, 100, 300), hLine("SECOURS", 100, 134, 300)];
    expect(sentence(lines, "fr", 1, "SECOURS")).toBe("SORTIE DE SECOURS");
  });

  it("keeps only the tapped line and its neighbours when there is no punctuation", () => {
    const lines = ["PAIN", "FROMAGE", "JAMBON", "BEURRE", "SEL"].map((t, k) => hLine(t, 100, 100 + 34 * k, 300));
    expect(sentence(lines, "fr", 2, "JAMBON")).toBe("FROMAGE JAMBON BEURRE");
    expect(sentence(lines, "fr", 0, "PAIN")).toBe("PAIN FROMAGE");
    expect(sentence(lines, "fr", 4, "SEL")).toBe("BEURRE SEL");
  });

  it("keeps the exact sentence when the text has punctuation", () => {
    const lines = ["Il mange du pain.", "Elle boit de l'eau.", "Ils partent."].map((t, k) => hLine(t, 100, 100 + 34 * k, 300));
    expect(sentence(lines, "fr", 1, "eau")).toBe("Elle boit de l'eau.");
  });

  it("rejoins a word split by an end-of-line hyphen, whichever half is tapped", () => {
    const lines = [hLine("Il a été extra-", 100, 100, 400), hLine("ordinaire hier. Puis rien.", 100, 134, 400)];
    expect(sentence(lines, "fr", 0, "extra")).toBe("Il a été extraordinaire hier.");
    expect(sentence(lines, "fr", 1, "hier")).toBe("Il a été extraordinaire hier.");
  });

  it("keeps the hyphen when the next line starts with a capital", () => {
    const lines = [hLine("Jean-", 100, 100, 400), hLine("Pierre arrive.", 100, 134, 400)];
    expect(sentence(lines, "fr", 1, "Pierre")).toBe("Jean- Pierre arrive.");
  });

  it("collapses repeated spaces", () => {
    expect(one("Il   mange   ici.", "ici")).toBe("Il mange ici.");
  });
});

describe("Chinese sentence rules", () => {
  it("cuts at 。！？ and joins lines without spaces", () => {
    const lines = [hLine("今天天气很好，我们去", 100, 100, 400), hLine("公园玩。明天会下雨。", 100, 134, 400)];
    expect(sentence(lines, "zh", 1, "公园")).toBe("今天天气很好，我们去公园玩。");
    expect(sentence(lines, "zh", 1, "明天")).toBe("明天会下雨。");
  });

  it("sends a sign's whole text when it has no punctuation", () => {
    const lines = [hLine("请勿", 100, 100, 100), hLine("吸烟", 100, 134, 100)];
    expect(sentence(lines, "zh", 1, "吸烟")).toBe("请勿吸烟");
  });

  it("reads vertical columns right to left", () => {
    const lines = [vLine("我们走吧。", 260, 100, 200), vLine("他说你好，", 300, 100, 200)];
    expect(sentence(lines, "zh", 0, "我们")).toBe("他说你好，我们走吧。");
  });
});

describe("the 300-character limit", () => {
  const manyLines = Array.from({ length: 40 }, (_, k) => hLine(`mot${k} autre${k} texte${k}`, 100, 100 + 34 * k, 400));
  const find = createSentenceFinder(manyLines, getLang("fr"));

  it.each([0, 20, 39])("holds the word and stays under the limit (line %i)", (line) => {
    const word = `autre${line}`;
    const result = find(wordRef(manyLines, "fr", line, word));
    expect(result.length).toBeLessThanOrEqual(300);
    expect(result).toContain(word);
  });

  it("starts and ends on whole words", () => {
    const result = find(wordRef(manyLines, "fr", 20, "autre20"));
    for (const part of result.split(" ")) expect(part).toMatch(/^(mot|autre|texte)\d+$/);
  });

  it("honours a smaller limit", () => {
    const result = sentence(manyLines, "fr", 20, "autre20", 60);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).toContain("autre20");
  });
});
