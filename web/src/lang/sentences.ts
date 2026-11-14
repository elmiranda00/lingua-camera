// Sentence-end test shared by the language modules
const CLOSERS = new Set(["»", "”", "’", "'", '"', ")", "]"]);
const INITIAL = /(^|[^\p{L}])\p{Lu}$/u;

interface EndRule {
  enders: string;
  // Spaced scripts: an ender only ends a sentence at a word break (not in 3.5 or www.site.fr)
  spaced: boolean;
}

/** True when the character at `index` closes a sentence. */
export function isSentenceEndAt(text: string, index: number, { enders, spaced }: EndRule): boolean {
  const ch = text[index];
  if (ch === undefined || !enders.includes(ch)) return false;
  if (!spaced) return true;

  const next = text[index + 1];
  if (next !== undefined && !/\s/.test(next) && !CLOSERS.has(next)) return false;
  // "M. Dupont": a lone capital before the dot is an initial, not the end of a sentence
  if (ch === "." && INITIAL.test(text.slice(0, index))) return false;
  return true;
}

/** Index just past a sentence end and any closing quotes or brackets after it (French puts a space before »). */
export function endWithClosers(text: string, endIndex: number): number {
  let end = endIndex + 1;
  for (;;) {
    const next = text[end];
    if (next !== undefined && CLOSERS.has(next)) end++;
    else if (next === " " && text[end + 1] === "»") end += 2;
    else return end;
  }
}
