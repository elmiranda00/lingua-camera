// Lookup cache, daily cap and timing logs (full app in workerd, AI mocked, local D1)
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, LookupResponse, type LookupRequest } from "@lingua-camera/shared";
import type { ModelRunner } from "../src/env.ts";
import { cacheKey } from "../src/lib/cache.ts";
import { LOOKUP_LLM } from "../src/llm.ts";
import { utcDay } from "../src/lib/usage.ts";
import { LIMITS } from "../src/limits.ts";
import {
  call,
  db,
  goodReply,
  goodResult,
  lookupInit,
  makeEnv,
  OTHER_TOKEN,
  resetState,
  seedUsers,
  usageOf,
  validLookup,
} from "./helpers.ts";

beforeAll(seedUsers);
beforeEach(resetState);

const MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const PROMPT = LOOKUP_LLM.prompt.version;
type Ai = { run: ReturnType<typeof vi.fn<ModelRunner["run"]>> };
const aiWith = (output: unknown): Ai => ({ run: vi.fn<ModelRunner["run"]>().mockResolvedValue(output) });
const failingAi = (): Ai => ({ run: vi.fn<ModelRunner["run"]>().mockRejectedValue(new Error("capacity")) });
const okAi = () => aiWith({ response: goodReply });

const lookup = (ai: Ai, body: unknown = validLookup, token?: string) =>
  call(makeEnv(ai), "/api/lookup", lookupInit(body, token));

const setLookups = (userId: string, lookups: number) =>
  db().prepare("INSERT OR REPLACE INTO usage (user_id, day, lookups) VALUES (?, ?, ?)").bind(userId, utcDay(), lookups).run();

describe("the lookup cache", () => {
  it("answers a repeat from the cache without calling the model", async () => {
    const ai = okAi();
    const first = LookupResponse.parse(await (await lookup(ai)).json());
    const second = LookupResponse.parse(await (await lookup(ai)).json());
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.meaningInContext).toBe(first.meaningInContext);
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  it("serves one user's lookup to another", async () => {
    const ai = okAi();
    await lookup(ai);
    const res = await lookup(ai, validLookup, OTHER_TOKEN);
    expect(LookupResponse.parse(await res.json()).cached).toBe(true);
    expect(ai.run).toHaveBeenCalledTimes(1);
  });

  it("treats the same word in another sentence as a new lookup", async () => {
    const ai = okAi();
    await lookup(ai);
    await lookup(ai, { ...validLookup, sentence: "出口在右边。" });
    expect(ai.run).toHaveBeenCalledTimes(2);
  });

  it("ignores extra spaces and Unicode form differences", async () => {
    const ai = okAi();
    await lookup(ai, { lang: "fr", word: "café", sentence: "Un café noir." });
    const res = await lookup(ai, { lang: "fr", word: "café", sentence: "  Un   café noir. " });
    expect(LookupResponse.parse(await res.json()).cached).toBe(true);
  });

  it("stores the answer only, never the word or the sentence", async () => {
    await lookup(okAi());
    const rows = await db().prepare("SELECT key, response FROM lookup_cache").all<{ key: string; response: string }>();
    expect(rows.results).toHaveLength(1);
    const stored = rows.results[0]!;
    expect(stored.key).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.response).not.toContain(validLookup.sentence);
    expect(JSON.parse(stored.response)).toEqual(goodResult);
  });

  it("treats a stored row that no longer fits the schema as a miss and replaces it", async () => {
    const ai = okAi();
    const key = await cacheKey(validLookup as LookupRequest, MODEL, PROMPT);
    await db().prepare("INSERT INTO lookup_cache (key, response) VALUES (?, ?)").bind(key, '{"surface":"x"}').run();
    const res = LookupResponse.parse(await (await lookup(ai)).json());
    expect(res.cached).toBe(false);
    expect(ai.run).toHaveBeenCalledTimes(1);
    const repeat = LookupResponse.parse(await (await lookup(ai)).json());
    expect(repeat.cached).toBe(true);
  });

  it("does not cache a failed lookup", async () => {
    expect((await lookup(failingAi())).status).toBe(502);
    const ai = okAi();
    expect(LookupResponse.parse(await (await lookup(ai)).json()).cached).toBe(false);
  });
});

describe("cache keys", () => {
  const req: LookupRequest = { lang: "fr", word: "chat", sentence: "Le chat dort." };
  const key = (overrides: Partial<LookupRequest> = {}, model = MODEL, prompt = PROMPT) =>
    cacheKey({ ...req, ...overrides }, model, prompt);

  it("is a SHA-256 hex string and stable", async () => {
    expect(await key()).toMatch(/^[0-9a-f]{64}$/);
    expect(await key()).toBe(await key());
  });

  const changes: [string, Partial<LookupRequest>, string, string][] = [
    ["language", { lang: "zh" }, MODEL, PROMPT],
    ["word", { word: "chien" }, MODEL, PROMPT],
    ["sentence", { sentence: "Le chat mange." }, MODEL, PROMPT],
    ["model", {}, "@cf/other/model", PROMPT],
    ["prompt version", {}, MODEL, `${PROMPT}-next`],
  ];
  it.each(changes)("changes with the %s", async (_label, overrides, model, prompt) => {
    expect(await key(overrides, model, prompt)).not.toBe(await key());
  });

  it("keeps case, because Marie and marie differ", async () => {
    expect(await key({ word: "Marie" })).not.toBe(await key({ word: "marie" }));
  });

  it("doesn't mix up fields that run together", async () => {
    expect(await key({ word: "a", sentence: "bc" })).not.toBe(await key({ word: "ab", sentence: "c" }));
  });
});

describe("the daily cap", () => {
  it("counts a lookup once, per user", async () => {
    await lookup(okAi());
    await lookup(okAi(), { ...validLookup, word: "入口" }, OTHER_TOKEN);
    expect(await usageOf("user-1")).toMatchObject({ lookups: 1 });
    expect(await usageOf("user-3")).toMatchObject({ lookups: 1 });
  });

  it("does not count cache hits", async () => {
    const ai = okAi();
    await lookup(ai);
    await lookup(ai);
    await lookup(ai);
    expect(await usageOf("user-1")).toMatchObject({ lookups: 1 });
  });

  it("refuses the lookup past the cap with a 429, and never calls the model", async () => {
    await setLookups("user-1", LIMITS.lookupsPerDay);
    const ai = okAi();
    const res = await lookup(ai);
    expect(res.status).toBe(429);
    const error = ApiError.parse(await res.json()).error;
    expect(error.code).toBe("rate_limited");
    expect(error.message).toContain("00:00 UTC");
    expect(ai.run).not.toHaveBeenCalled();
    expect(await usageOf("user-1")).toMatchObject({ lookups: LIMITS.lookupsPerDay });
  });

  it("allows the last lookup of the day", async () => {
    await setLookups("user-1", LIMITS.lookupsPerDay - 1);
    expect((await lookup(okAi())).status).toBe(200);
    expect(await usageOf("user-1")).toMatchObject({ lookups: LIMITS.lookupsPerDay });
  });

  it("still serves cached answers past the cap", async () => {
    const ai = okAi();
    await lookup(ai);
    await setLookups("user-1", LIMITS.lookupsPerDay);
    const res = await lookup(ai);
    expect(res.status).toBe(200);
    expect(LookupResponse.parse(await res.json()).cached).toBe(true);
  });

  it("is per user: one user at the cap doesn't block another", async () => {
    await setLookups("user-1", LIMITS.lookupsPerDay);
    expect((await lookup(okAi(), validLookup, OTHER_TOKEN)).status).toBe(200);
  });

  it("starts a fresh count each UTC day", async () => {
    await db().prepare("INSERT INTO usage (user_id, day, lookups) VALUES (?, ?, ?)").bind("user-1", "2000-01-01", LIMITS.lookupsPerDay).run();
    expect((await lookup(okAi())).status).toBe(200);
  });

  it("gives the slot back when the model fails", async () => {
    await setLookups("user-1", 5);
    expect((await lookup(aiWith({ response: "not json" }))).status).toBe(502);
    expect(await usageOf("user-1")).toMatchObject({ lookups: 5 });
  });

  it("never lets the count go below zero when giving a slot back", async () => {
    await lookup(failingAi());
    expect((await usageOf("user-1"))?.lookups).toBe(0);
  });
});

describe("the TTS cap", () => {
  const speak = (ai: Ai) =>
    call(makeEnv(ai), "/api/tts", lookupInit({ lang: "zh", text: "出口" }));

  it("counts speech separately from lookups and refuses past its cap", async () => {
    const ai = aiWith({ audio: btoa("ID3") });
    await db().prepare("INSERT INTO usage (user_id, day, tts) VALUES (?, ?, ?)").bind("user-1", utcDay(), LIMITS.ttsPerDay).run();
    const res = await speak(ai);
    expect(res.status).toBe(429);
    expect(ai.run).not.toHaveBeenCalled();
    expect(await usageOf("user-1")).toMatchObject({ lookups: 0, tts: LIMITS.ttsPerDay });
  });

  it("counts a successful call and gives the slot back on failure", async () => {
    await speak(aiWith({ audio: btoa("ID3") }));
    expect(await usageOf("user-1")).toMatchObject({ tts: 1 });
    await speak(failingAi());
    expect(await usageOf("user-1")).toMatchObject({ tts: 1 });
  });
});

describe("logging", () => {
  async function logged(ai: Ai, headers: Record<string, string> = {}) {
    const spy = vi.spyOn(console, "log");
    const init = lookupInit(validLookup);
    await call(makeEnv(ai), "/api/lookup", { ...init, headers: { ...(init.headers as Record<string, string>), ...headers } });
    const lines = spy.mock.calls.map((args) => String(args[0]));
    spy.mockRestore();
    return lines.map((l) => JSON.parse(l) as Record<string, unknown>).at(-1)!;
  }

  it("records cached, db_ms, model_ms and the prompt version", async () => {
    const miss = await logged(okAi());
    expect(miss).toMatchObject({ cached: false, prompt: PROMPT, model: MODEL, status: 200 });
    expect(miss.db_ms).toEqual(expect.any(Number));
    expect(miss.model_ms).toEqual(expect.any(Number));

    const hit = await logged(okAi());
    expect(hit).toMatchObject({ cached: true });
    expect(hit.db_ms).toEqual(expect.any(Number));
    expect(hit).not.toHaveProperty("model_ms");
  });

  it("records the client's ocr_ms", async () => {
    expect(await logged(okAi(), { "x-ocr-ms": "1234" })).toMatchObject({ ocr_ms: 1234 });
  });

  it("records a refused lookup as a daily limit", async () => {
    await setLookups("user-1", LIMITS.lookupsPerDay);
    expect(await logged(okAi())).toMatchObject({ status: 429, error: "daily_limit" });
  });

  it("never logs the word, sentence or cached text", async () => {
    const spy = vi.spyOn(console, "log");
    await lookup(okAi());
    await lookup(okAi());
    const text = spy.mock.calls.map((args) => args.join(" ")).join("\n");
    spy.mockRestore();
    expect(text).not.toContain("出口");
    expect(text).not.toContain("exit");
  });
});
