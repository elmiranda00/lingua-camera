// The sentence around a tapped word, sent with it for lookup
//
// Lines are grouped into blocks, joined in reading order, and cut at sentence ends
import { LIMITS } from "@lingua-camera/shared";
import { groupBlocks } from "./blocks.ts";
import { endWithClosers } from "./sentences.ts";
import type { LangModule, OcrLine } from "./types.ts";

/** Where a word sits: its line, and its offsets within that line's text. */
export interface WordRef {
  line: number;
  start: number;
  end: number;
}

/** The text window of at most `max` characters that holds [a, b), cut at word boundaries. */
function clip(text: string, a: number, b: number, max: number, lang: LangModule): string {
  if (text.length <= max) return text;
  const room = max - (b - a);
  const to0 = Math.min(text.length, Math.max(0, a - Math.floor(room / 2)) + max);
  const from0 = Math.max(0, to0 - max);

  const tokens = lang.segment(text);
  const from = Math.min(a, tokens.find((t) => t.start >= from0)?.start ?? from0);
  const to = Math.max(b, [...tokens].reverse().find((t) => t.end <= to0)?.end ?? to0);
  return text.slice(from, to);
}

// Lines kept above and below the tapped one when the text has no sentence end to cut at
const NEIGHBOUR_LINES = 1;

export function createSentenceFinder(
  lines: OcrLine[],
  lang: LangModule,
  maxChars: number = LIMITS.sentenceMaxChars,
): (word: WordRef) => string {
  const { blocks, blockOf } = groupBlocks(lines);
  const joined = blocks.map((block) => lang.joinLines(block.map((i) => lines[i]!.text)));

  // Cuts the sentence around [a, z); `open` is true when no sentence end was found on either side
  function cut(text: string, a: number, z: number) {
    let start = 0;
    let startFound = false;
    for (let i = a - 1; i >= 0; i--) {
      if (lang.isSentenceEnd(text, i)) {
        start = endWithClosers(text, i);
        startFound = true;
        break;
      }
    }
    let end = text.length;
    let endFound = false;
    for (let i = z; i < text.length; i++) {
      if (lang.isSentenceEnd(text, i)) {
        end = endWithClosers(text, i);
        endFound = true;
        break;
      }
    }
    // Leading spaces shift offsets, so trim after cutting and clip with the shifted positions
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    return {
      sentence: raw.trim(),
      a: a - start - lead,
      z: z - start - lead,
      open: !startFound && !endFound,
    };
  }

  const finish = (c: { sentence: string; a: number; z: number }) =>
    clip(c.sentence, c.a, c.z, maxChars, lang).trim().replace(/\s+/g, " ");

  return (word) => {
    const b = blockOf[word.line];
    const block = b === undefined ? undefined : blocks[b];
    const text = b === undefined ? undefined : joined[b];
    if (!block || !text) return "";

    const k = block.indexOf(word.line);
    const whole = cut(text.text, (text.starts[k] ?? 0) + word.start, (text.starts[k] ?? 0) + word.end);
    if (!whole.open) return finish(whole);

    // Menus, labels and signs: no punctuation, so the block is a list rather than a sentence.
    // Keep the tapped line and its neighbours only.
    const first = Math.max(0, k - NEIGHBOUR_LINES);
    const near = lang.joinLines(block.slice(first, k + NEIGHBOUR_LINES + 1).map((i) => lines[i]!.text));
    const offset = near.starts[k - first] ?? 0;
    return finish(cut(near.text, offset + word.start, offset + word.end));
  };
}
