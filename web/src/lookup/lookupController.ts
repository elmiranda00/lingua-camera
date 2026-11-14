// Runs lookups for the translation sheet: one at a time, cached per photo
//
// Plain TypeScript (no React) so it can be tested in Node
import type { Lang, LookupRequest, LookupResult } from "@lingua-camera/shared";
import { ApiRequestError } from "../api/client.ts";

export interface WordInfo {
  word: string;
  lang: Lang;
  result: LookupResult;
  pinyin: string | null; // pinyin-pro first, the model's as fallback
}

export type Failure = "sign_in" | "limit" | "other";

export type SheetState =
  | { status: "idle" }
  | { status: "loading"; word: string }
  | { status: "ready"; info: WordInfo }
  | { status: "error"; word: string; failure: Failure };

export const FAILURE_MESSAGE: Record<Failure, string> = {
  sign_in: "Sign in needed. Open your invite link on this phone.",
  limit: "Daily limit reached, resets at 00:00 UTC.",
  other: "Couldn't translate right now. Try again.",
};

export function failureOf(error: unknown): Failure {
  if (error instanceof ApiRequestError) {
    if (error.code === "unauthorized") return "sign_in";
    if (error.code === "rate_limited") return "limit";
  }
  return "other";
}

export interface LookupDeps {
  lookup(req: LookupRequest, signal: AbortSignal): Promise<LookupResult>;
  pinyin(word: string): Promise<string | null>;
}

const keyOf = (req: LookupRequest) => `${req.lang}\u0000${req.word}\u0000${req.sentence}`;

export function createLookupController(deps: LookupDeps, onChange: (state: SheetState) => void) {
  let state: SheetState = { status: "idle" };
  let current: { key: string; abort: AbortController } | null = null;
  let last: LookupRequest | null = null;
  const cache = new Map<string, WordInfo>();

  const set = (next: SheetState) => {
    state = next;
    onChange(next);
  };

  function cancel() {
    current?.abort.abort();
    current = null;
  }

  async function start(req: LookupRequest): Promise<void> {
    const key = keyOf(req);
    // Tapping the word already shown (or loading) changes nothing; after an error it tries again
    if (current?.key === key && state.status !== "error") return;
    cancel();
    last = req;

    const hit = cache.get(key);
    if (hit) {
      current = { key, abort: new AbortController() };
      set({ status: "ready", info: hit });
      return;
    }

    const abort = new AbortController();
    current = { key, abort };
    set({ status: "loading", word: req.word });
    try {
      // The sheet shows the meaning and the pinyin together, so wait for both
      const [result, pinyin] = await Promise.all([deps.lookup(req, abort.signal), deps.pinyin(req.word)]);
      if (abort.signal.aborted) return;
      const info: WordInfo = { word: req.word, lang: req.lang, result, pinyin: pinyin ?? result.pinyin };
      cache.set(key, info);
      set({ status: "ready", info });
    } catch (error) {
      if (abort.signal.aborted) return;
      set({ status: "error", word: req.word, failure: failureOf(error) });
    }
  }

  return {
    start,
    retry: () => (last ? start(last) : Promise.resolve()),
    /** Closes the sheet; results stay cached for this photo. */
    close() {
      cancel();
      set({ status: "idle" });
    },
    /** New photo or language: close and forget everything. */
    reset() {
      cancel();
      cache.clear();
      last = null;
      set({ status: "idle" });
    },
  };
}
