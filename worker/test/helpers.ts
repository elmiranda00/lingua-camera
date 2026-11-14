// Shared setup for the full-app Worker tests: env, requests, seeded users
import { env as realEnv } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { app } from "../src/index.ts";
import type { Env, ModelRunner } from "../src/env.ts";
import { hashToken } from "../src/lib/auth.ts";

export const TOKEN = "test-token"; // user-1
export const OTHER_TOKEN = "other-token"; // user-3
export const DISABLED_TOKEN = "disabled-token"; // user-2, disabled

export const goodResult = {
  surface: "出口",
  headword: "出口",
  pos: "noun",
  gender: null,
  pinyin: "chū kǒu",
  meaningInContext: "exit",
  otherMeanings: ["to export", "to speak"],
  note: null,
};
export const goodReply = JSON.stringify(goodResult);

export const validLookup = { lang: "zh", word: "出口", sentence: "出口在左边。" };

export const db = () => (realEnv as unknown as Env).DB;

export function makeEnv(ai: ModelRunner, overrides: Partial<Env> = {}): Env {
  return { ...(realEnv as unknown as Env), AI: ai, ...overrides };
}

export async function call(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://lingua-camera.test${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx); // lets after-response work (cache write) finish
  return res;
}

export const lookupInit = (body: unknown, token = TOKEN): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

export async function seedUsers(): Promise<void> {
  const insert = db().prepare("INSERT OR REPLACE INTO users (id, name, token_hash, disabled) VALUES (?, ?, ?, ?)");
  await db().batch([
    insert.bind("user-1", "Test User", await hashToken(TOKEN), 0),
    insert.bind("user-2", "Gone User", await hashToken(DISABLED_TOKEN), 1),
    insert.bind("user-3", "Other User", await hashToken(OTHER_TOKEN), 0),
  ]);
}

/** Empties the cache and the daily counters, so tests don't see each other's lookups. */
export async function resetState(): Promise<void> {
  await db().batch([db().prepare("DELETE FROM lookup_cache"), db().prepare("DELETE FROM usage")]);
}

export async function usageOf(userId: string): Promise<{ lookups: number; tts: number } | null> {
  return db().prepare("SELECT lookups, tts FROM usage WHERE user_id = ?").bind(userId).first();
}
