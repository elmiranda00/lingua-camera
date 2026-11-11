// Request limits from the spec's limits table. Shared so both the Zod schemas
// and the Worker use the same numbers. The Worker re-exports these from
// worker/src/limits.ts, which is the place to read or change them.

export const LIMITS = {
  /** Lookups per user per UTC day; cache hits don't count. */
  lookupsPerDay: 150,
  /** TTS calls per user per UTC day. */
  ttsPerDay: 100,
  /** Max characters in a tapped word. */
  wordMaxChars: 40,
  /** Max characters in the context sentence. */
  sentenceMaxChars: 300,
  /** Max characters of text sent to TTS. */
  ttsTextMaxChars: 40,
  /** Max request body size in bytes. */
  bodyMaxBytes: 8 * 1024,
  /** Max saved words per user. */
  wordsPerUser: 10_000,
} as const;
