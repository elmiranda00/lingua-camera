// Full-app tests in workerd, AI mocked
import { env as realEnv } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it, vi } from "vitest";
import { ApiError, Health, LookupResponse } from "@lingua-camera/shared";
import { app } from "../src/index.ts";
import type { Env, ModelRunner } from "../src/env.ts";
import { CSP } from "../src/security.ts";

const TOKEN = "test-token";

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
  return { ...(realEnv as unknown as Env), AI: ai, M0_TOKEN: TOKEN, ...overrides };
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

describe("GET /api/health", () => {
  it("returns ok, version, request id and security headers", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/health");
    expect(res.status).toBe(200);
    expect(Health.parse(await res.json()).ok).toBe(true);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers.get("content-security-policy")).toBe(CSP);
    expect(res.headers.get("permissions-policy")).toBe("camera=(self)");
  });
});

describe("unknown API route", () => {
  it("returns a 404 error envelope", async () => {
    const res = await call(makeEnv({ run: vi.fn() }), "/api/nope");
    expect(res.status).toBe(404);
    expect(ApiError.parse(await res.json()).error.code).toBe("not_found");
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

  it("rejects everything when no M0 token is configured", async () => {
    const env = makeEnv({ run: vi.fn() }, { M0_TOKEN: undefined });
    const res = await call(env, "/api/lookup", lookupInit(validLookup));
    expect(res.status).toBe(401);
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
