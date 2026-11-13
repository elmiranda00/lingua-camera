// Tier for every word box on a page: saved > key > normal
import type { LangModule, OcrLine, WordBox } from "../lang/types.ts";

export type Tier = "saved" | "key" | "normal";

export interface TieredBox extends WordBox {
  tier: Tier;
  line: number; // index of the OCR line
}

const SENTENCE_END = /[.!?…]/;

// `saved` holds normalised saved words (see LangModule.normalizeForMatch). Lines are taken in the given order.
export function tierBoxes(lines: OcrLine[], lang: LangModule, saved: ReadonlySet<string> = new Set()): TieredBox[] {
  const out: TieredBox[] = [];
  let gap = ""; // text since the last word, across line breaks
  let first = true;
  lines.forEach((line, lineIndex) => {
    let lastEnd = 0;
    for (const box of lang.splitLineBoxes(line)) {
      gap += line.text.slice(lastEnd, box.start);
      const sentenceStart = first || SENTENCE_END.test(gap);
      const tier: Tier = saved.has(lang.normalizeForMatch(box.text))
        ? "saved"
        : lang.isKeyWord(box.text, { sentenceStart })
          ? "key"
          : "normal";
      out.push({ ...box, tier, line: lineIndex });
      gap = "";
      first = false;
      lastEnd = box.end;
    }
    gap += line.text.slice(lastEnd);
  });
  return out;
}
