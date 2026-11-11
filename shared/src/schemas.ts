// Zod schemas for every API request and response. Both the web app and the
// Worker validate against these, so the contract is defined once.
import { z } from "zod";
import { LIMITS } from "./limits.ts";

export const Lang = z.enum(["fr", "zh"]);
export type Lang = z.infer<typeof Lang>;

/** Text that isn't blank after trimming. */
const nonBlank = (max: number) =>
  z.string().trim().min(1).max(max);

// ---------- Errors ----------

export const ErrorCode = z.enum([
  "bad_request",
  "unauthorized",
  "not_found",
  "payload_too_large",
  "rate_limited",
  "model_error",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;

// ---------- GET /api/health ----------

export const Health = z.object({
  ok: z.literal(true),
  version: z.string(),
});
export type Health = z.infer<typeof Health>;

// ---------- POST /api/lookup ----------

export const LookupRequest = z.object({
  lang: Lang,
  word: nonBlank(LIMITS.wordMaxChars),
  sentence: nonBlank(LIMITS.sentenceMaxChars),
});
export type LookupRequest = z.infer<typeof LookupRequest>;

export const PartOfSpeech = z.enum([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "determiner",
  "preposition",
  "conjunction",
  "particle",
  "classifier",
  "numeral",
  "interjection",
  "phrase",
  "other",
]);
export type PartOfSpeech = z.infer<typeof PartOfSpeech>;

/** What the model must return for a lookup (spec: "LookupResult contract"). */
export const LookupResult = z.object({
  surface: z.string().min(1),
  headword: z.string().min(1),
  pos: PartOfSpeech,
  gender: z.enum(["m", "f"]).nullable(),
  pinyin: z.string().nullable(),
  meaningInContext: z.string().min(1).max(80),
  otherMeanings: z.array(z.string().min(1)).max(3),
  note: z.string().nullable(),
});
export type LookupResult = z.infer<typeof LookupResult>;

export const LookupResponse = LookupResult.extend({
  cached: z.boolean(),
  requestId: z.string(),
});
export type LookupResponse = z.infer<typeof LookupResponse>;

// ---------- POST /api/tts ----------

export const TtsRequest = z.object({
  lang: Lang,
  text: nonBlank(LIMITS.ttsTextMaxChars),
});
export type TtsRequest = z.infer<typeof TtsRequest>;
