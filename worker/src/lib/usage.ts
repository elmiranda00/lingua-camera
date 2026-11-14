// Per-user daily caps, counted in the usage table (days are UTC dates)

export type UsageKind = "lookups" | "tts";

// Fixed SQL per kind: column names can't be bound as parameters
const RESERVE: Record<UsageKind, string> = {
  lookups:
    "INSERT INTO usage (user_id, day, lookups) VALUES (?1, ?2, 1) " +
    "ON CONFLICT (user_id, day) DO UPDATE SET lookups = lookups + 1 WHERE lookups < ?3 RETURNING lookups",
  tts:
    "INSERT INTO usage (user_id, day, tts) VALUES (?1, ?2, 1) " +
    "ON CONFLICT (user_id, day) DO UPDATE SET tts = tts + 1 WHERE tts < ?3 RETURNING tts",
};
const RELEASE: Record<UsageKind, string> = {
  lookups: "UPDATE usage SET lookups = MAX(lookups - 1, 0) WHERE user_id = ? AND day = ?",
  tts: "UPDATE usage SET tts = MAX(tts - 1, 0) WHERE user_id = ? AND day = ?",
};

export const utcDay = (now = new Date()) => now.toISOString().slice(0, 10);

/** Takes one slot of today's cap in a single statement. False when the cap is already reached. */
export async function reserve(db: D1Database, userId: string, kind: UsageKind, limit: number): Promise<boolean> {
  const row = await db.prepare(RESERVE[kind]).bind(userId, utcDay(), limit).first();
  return row !== null;
}

/** Gives a slot back, e.g. when the model failed and the user got nothing for it. */
export async function release(db: D1Database, userId: string, kind: UsageKind): Promise<void> {
  await db.prepare(RELEASE[kind]).bind(userId, utcDay()).run();
}
