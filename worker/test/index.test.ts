// Full-app tests in workerd, AI mocked, local D1
import { env as realEnv } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError, Health, LookupResponse, Me } from "@lingua-camera/shared";
import { app } from "../src/index.ts";
import type { Env, ModelRunner } from "../src/env.ts";
import { hashToken } from "../src/lib/auth.ts";
import { CSP } from "../src/security.ts";

const TOKEN = "test-token";
const DISABLED_TOKEN = "disabled-token";

const goodReply = JSON.stringify({
  surface: "出口",
  headword: "出口",
  pos: "noun",
  gender: null,
  pinyin: "chū kǒu",
  meaningInContext: "exit",
  otherMeanings: ["to export", "to speak"],
  note: null,
});

function makeEnv(ai: ModelRunner, overrides: Partial<Env> = {}): Env {
  return { ...(realEnv as unknown as Env), AI: ai, ...overrides };
}

async function call(env: Env, path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await app.fetch(new Request(`https://lingua-camera.test${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

const lookupInit = (body: unknown, token = TOKEN): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

const validLookup = { lang: "zh", word: "出口", sentence: "出口在左边。" };

beforeAll(async () => {
  const db = (realEnv as unknown as Env).DB;
  const insert = db.prepare("INSERT OR REPLACE INTO users (id, name, token_hash, disabled) VALUES (?, ?, ?, ?)");
  await db.batch([
    insert.bind("user-1", "Test User", await hashToken(TOKEN), 0),
    insert.bind("user-2", "Gone User", await hashToken(DISABLED_TOKEN), 1),
  ]);
});

describe("GET /api/health", () => {
  it("returns ok, version, request id and security headers", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/health");
    expect(res.status).toBe(200);
    expect(Health.parse(await res.json()).ok).toBe(true);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("content-security-policy")).toBe(CSP);
    expect(res.headers.get("permissions-policy")).toBe("camera=(self)");
    // Cross-origin isolation for multi-threaded OCR
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(res.headers.get("cross-origin-embedder-policy")).toBe("require-corp");
  });
});

describe("unknown API route", () => {
  it("returns a 404 error envelope", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/nope");
    expect(res.status).toBe(404);
    expect(ApiError.parse(await res.json()).error.code).toBe("not_found");
  });
});

describe("GET /api/me", () => {
  const get = (token?: string): RequestInit => ({
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });

  it("returns the signed-in user", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/me", get(TOKEN));
    expect(res.status).toBe(200);
    expect(Me.parse(await res.json())).toEqual({ id: "user-1", name: "Test User" });
  });

  it.each([
    ["no token", undefined],
    ["an unknown token", "nope"],
    ["a disabled user's token", DISABLED_TOKEN],
    ["an over-long token", "x".repeat(500)],
  ])("rejects %s with 401", async (_label, token) => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/me", get(token));
    expect(res.status).toBe(401);
    expect(ApiError.parse(await res.json()).error.code).toBe("unauthorized");
  });
});

describe("POST /api/lookup", () => {
  it("rejects a missing token", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/lookup", {
      method: "POST",
      body: JSON.stringify(validLookup),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a wrong token", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/lookup", lookupInit(validLookup, "nope"));
    expect(res.status).toBe(401);
  });

  it("rejects a disabled user and never calls the model", async () => {
    const run = vi.fn();
    const res = await call(makeEnv({ run }), "/api/lookup", lookupInit(validLookup, DISABLED_TOKEN));
    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects an invalid body with 400", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/lookup", lookupInit({ lang: "de" }));
    expect(res.status).toBe(400);
    expect(ApiError.parse(await res.json()).error.code).toBe("bad_request");
  });

  it("rejects a body over 8 KB with 413", async () => {
    const big = { ...validLookup, sentence: "x".repeat(9000) };
    const res = await call(makeEnv({ run: vi.fn() }), "/api/lookup", lookupInit(big));
    expect(res.status).toBe(413);
  });

  it("returns a validated result", async () => {
    const run = vi.fn().mockResolvedValue({ response: goodReply });
    const res = await call(makeEnv({ run }), "/api/lookup", lookupInit(validLookup));
    expect(res.status).toBe(200);
    const body = LookupResponse.parse(await res.json());
    expect(body.headword).toBe("出口");
    expect(body.cached).toBe(false);
    expect(body.requestId).toBe(res.headers.get("x-request-id"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0]).toBe("@cf/qwen/qwen3-30b-a3b-fp8");
  });

  it("retries once on invalid output, then succeeds", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ response: "Sure! Here is the word..." })
      .mockResolvedValueOnce({ choices: [{ message: { content: goodReply } }] });
    const res = await call(makeEnv({ run }), "/api/lookup", lookupInit(validLookup));
    expect(res.status).toBe(200);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("returns a typed 502 after two bad replies", async () => {
    const run = vi.fn().mockResolvedValue({ response: '{"surface": "x"}' });
    const res = await call(makeEnv({ run }), "/api/lookup", lookupInit(validLookup));
    expect(res.status).toBe(502);
    expect(ApiError.parse(await res.json()).error.code).toBe("model_error");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("returns a typed 502 when the model throws", async () => {
    const run = vi.fn().mockRejectedValue(new Error("capacity"));
    const res = await call(makeEnv({ run }), "/api/lookup", lookupInit(validLookup));
    expect(res.status).toBe(502);
  });

  it("never logs the word or sentence", async () => {
    const spy = vi.spyOn(console, "log");
    const run = vi.fn().mockResolvedValue({ response: goodReply });
    await call(makeEnv({ run }), "/api/lookup", lookupInit(validLookup));
    const logged = spy.mock.calls.map((args) => args.join(" ")).join("\n");
    expect(logged).toContain("lookup.v1");
    expect(logged).not.toContain("出口");
    expect(logged).not.toContain(TOKEN);
    spy.mockRestore();
  });
});

describe("POST /api/tts", () => {
  it("rejects a missing token", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/tts", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("returns audio bytes", async () => {
    const run = vi.fn().mockResolvedValue({ audio: btoa("ID3fake") });
    const res = await call(makeEnv({ run }), "/api/tts", lookupInit({ lang: "zh", text: "出口" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes)).toBe("ID3fake");
  });

  it("returns a typed 502 when the model can't speak the language", async () => {
    const run = vi.fn().mockRejectedValue(new Error("unsupported lang"));
    const res = await call(makeEnv({ run }), "/api/tts", lookupInit({ lang: "zh", text: "出口" }));
    expect(res.status).toBe(502);
  });
});
