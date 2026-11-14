// Types and the per-language interface (all language-specific logic sits behind LangModule)
import type { Lang } from "@lingua-camera/shared";

export type Point = [number, number];
// Corners in order: top-left, top-right, bottom-right, bottom-left (as PaddleOCR returns them)
export type Quad = [Point, Point, Point, Point];

export interface OcrLine {
  text: string;
  poly: Point[];
}

// A token of a line; offsets are UTF-16 indexes into the line text
export interface Word {
  text: string;
  start: number;
  end: number;
  wordLike: boolean;
}

export interface WordBox extends Word {
  quad: Quad;
}

export interface KeyWordContext {
  // True when the word begins a sentence (a capital there says nothing about names)
  sentenceStart: boolean;
}

// Lines of one block as running text; starts[k] is where line k begins in `text`
export interface JoinedLines {
  text: string;
  starts: number[];
}

export interface LangModule {
  lang: Lang;
  segment(text: string): Word[];
  // Boxes for the word-like tokens of one line
  splitLineBoxes(line: OcrLine): WordBox[];
  // Lines of a block in reading order -> one text (French: spaces, end-of-line hyphens rejoined; Chinese: none)
  joinLines(texts: string[]): JoinedLines;
  // True when text[index] closes a sentence
  isSentenceEnd(text: string, index: number): boolean;
  normalizeForMatch(word: string): string;
  isKeyWord(word: string, ctx: KeyWordContext): boolean;
  collator: Intl.Collator;
  speechLang: string;
}
