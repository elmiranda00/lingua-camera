// French: word splitting, box widths, key-word rule
import common from "../tiers/data/fr-common.json";
import { boxesForWords } from "./lineBoxes.ts";
import type { KeyWordContext, LangModule, OcrLine, Word } from "./types.ts";

const COMMON = new Set<string>(common);
const segmenter = new Intl.Segmenter("fr", { granularity: "word" });

// Elisions get their own box: l'homme -> l' + homme (aujourd'hui, quelqu'un stay whole)
const ELISION = /^(l|d|j|m|t|s|n|c|qu|jusqu|lorsqu|puisqu|quoiqu)['’]/i;
const APOSTROPHE = /[’‘`]/g;
const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

// Relative glyph widths for body text; accented letters count as their base letter
const NARROW = new Set("ijlt'’.,;:!|");
const MID_NARROW = new Set("fr()[]-«»\"“”");
const NORMAL_SMALL = new Set("aecz");

function charWidth(ch: string): number {
  if (ch === " ") return 0.25;
  const base = ch.normalize("NFD")[0] ?? ch;
  if (NARROW.has(base)) return 0.28;
  if (MID_NARROW.has(base)) return 0.34;
  if (base === "m" || base === "w") return 0.78;
  if (base === "M" || base === "W") return 0.9;
  if (base === "I") return 0.34;
  if (/\p{Lu}/u.test(base)) return 0.7;
  if (NORMAL_SMALL.has(base)) return 0.44;
  return 0.5;
}

function segment(text: string): Word[] {
  const raw: Word[] = [...segmenter.segment(text)].map((s) => ({
    text: s.segment,
    start: s.index,
    end: s.index + s.segment.length,
    wordLike: s.isWordLike === true,
  }));

  // Hyphenated compounds stay whole: peut + - + être -> peut-être
  const joined: Word[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i]!;
    const prev = joined.at(-1);
    const next = raw[i + 1];
    if (cur.text === "-" && prev?.wordLike && next?.wordLike && prev.end === cur.start && next.start === cur.end) {
      prev.text += "-" + next.text;
      prev.end = next.end;
      i++;
    } else {
      joined.push({ ...cur });
    }
  }

  return joined.flatMap((w) => {
    const m = w.wordLike ? ELISION.exec(w.text) : null;
    if (!m || m[0].length === w.text.length) return [w];
    const cut = w.start + m[0].length;
    return [
      { text: m[0], start: w.start, end: cut, wordLike: true },
      { text: w.text.slice(m[0].length), start: cut, end: w.end, wordLike: true },
    ];
  });
}

function normalizeForMatch(word: string): string {
  return word.normalize("NFC").toLowerCase().replace(APOSTROPHE, "'").replace(ELISION, "").replace(EDGE_PUNCT, "");
}

// Compounds such as dit-il count as common when every part is
function isCommonForm(form: string): boolean {
  if (COMMON.has(form)) return true;
  return form.includes("-") && form.split("-").every((part) => COMMON.has(part));
}

function isKeyWord(word: string, ctx: KeyWordContext): boolean {
  const form = normalizeForMatch(word);
  if (!/\p{L}/u.test(form)) return false; // numbers, symbols, bare elision prefixes
  // A capitalised word inside a sentence is a name (all-caps headings are not)
  const letters = word.replace(/[^\p{L}]/gu, "");
  const first = letters[0] ?? "";
  const capitalised = letters.length > 1 && first !== first.toLowerCase() && letters.slice(1) === letters.slice(1).toLowerCase();
  if (capitalised && !ctx.sentenceStart) return false;
  return !isCommonForm(form);
}

export const fr: LangModule = {
  lang: "fr",
  segment,
  splitLineBoxes: (line: OcrLine) =>
    boxesForWords(
      segment(line.text).filter((w) => w.wordLike),
      line,
      charWidth,
    ),
  normalizeForMatch,
  isKeyWord,
  collator: new Intl.Collator("fr"),
  speechLang: "fr-FR",
};
