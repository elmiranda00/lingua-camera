import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, createApiClient } from "../../src/api/client.ts";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "x-request-id": "req-1" },
    ...init,
  });

const clientWith = (fetchImpl: typeof fetch) => createApiClient({ fetch: fetchImpl, timeoutMs: 1000 });

afterEach(() => vi.restoreAllMocks());

describe("getHealth", () => {
  it("returns a validated health response", async () => {
    const client = clientWith(async () => json({ ok: true, version: "abc123" }));
    await expect(client.getHealth()).resolves.toEqual({ ok: true, version: "abc123" });
  });

  it("requests /api/health", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => json({ ok: true, version: "x" }));
    await clientWith(fetchMock as unknown as typeof fetch).getHealth();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/health");
  });

  it("rejects a 200 response that breaks the contract", async () => {
    const client = clientWith(async () => json({ ok: false }));
    await expect(client.getHealth()).rejects.toMatchObject({ code: "bad_response", requestId: "req-1" });
  });

  it("turns an error envelope into a typed error", async () => {
    const envelope = { error: { code: "rate_limited", message: "Slow down." }, requestId: "req-9" };
    const client = clientWith(async () => json(envelope, { status: 429 }));
    const err = await client.getHealth().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ code: "rate_limited", status: 429, requestId: "req-1" });
  });

  it("falls back to the envelope's request ID when the header is missing", async () => {
    const envelope = { error: { code: "internal", message: "Oops." }, requestId: "req-env" };
    const client = clientWith(async () => new Response(JSON.stringify(envelope), { status: 500 }));
    await expect(client.getHealth()).rejects.toMatchObject({ requestId: "req-env" });
  });

  it("handles a non-JSON error page", async () => {
    const client = clientWith(async () => new Response("<html>bad gateway</html>", { status: 502 }));
    await expect(client.getHealth()).rejects.toMatchObject({ code: "bad_response", status: 502 });
  });

  it("reports a network failure", async () => {
    const client = clientWith(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(client.getHealth()).rejects.toMatchObject({ code: "network", status: null });
  });

  it("reports a timeout", async () => {
    const client = clientWith(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(client.getHealth()).rejects.toMatchObject({ code: "timeout" });
  });

  it("logs only the path, code, status and request ID on failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = clientWith(async () => json({ ok: false, secret: "do-not-log" }));
    await client.getHealth().catch(() => {});
    expect(spy).toHaveBeenCalledWith("API request failed", {
      path: "/api/health",
      code: "bad_response",
      status: 200,
      requestId: "req-1",
    });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("do-not-log");
  });
});
