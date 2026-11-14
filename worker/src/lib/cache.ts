// Lookup cache in D1: one row per (language, model, prompt version, word, sentence)
//
// Stores the model's validated answer only, never the word or sentence. Shared by all users
import { LookupResult, type LookupRequest } from "@lingua-camera/shared";
import { sha256Hex } from "./hash.ts";

/** NFC, trimmed, runs of whitespace collapsed. Case is kept: Marie and marie differ. */
const normalise = (text: string) => text.normalize("NFC").replace(/\s+/g, " ").trim();

export function cacheKey(req: LookupRequest, model: string, promptVersion: string): Promise<string> {
  return sha256Hex(
    [req.lang, model, promptVersion, normalise(req.word), normalise(req.sentence)].join("\u0000"),
  );
}

/** The cached answer, or null on a miss. A row that no longer fits the schema counts as a miss. */
export async function readCache(db: D1Database, key: string): Promise<LookupResult | null> {
  const row = await db.prepare("SELECT response FROM lookup_cache WHERE key = ?").bind(key).first<{ response: string }>();
  if (!row) return null;
  try {
    const parsed = LookupResult.safeParse(JSON.parse(row.response));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeCache(db: D1Database, key: string, result: LookupResult): Promise<void> {
  await db
    .prepare("INSERT OR REPLACE INTO lookup_cache (key, response) VALUES (?, ?)")
    .bind(key, JSON.stringify(result))
    .run();
}
