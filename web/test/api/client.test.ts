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

describe("getMe and the Bearer token", () => {
  const TOKEN = "ww_XD96oHXQuxFnP6bdFClnRVou9W4W4bi3WBlB34qI";
  const me = { id: "u1", name: "Elrich" };

  function sentHeaders(fetchMock: ReturnType<typeof vi.fn>): Headers {
    return new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers);
  }

  it("sends the saved token", async () => {
    const fetchMock = vi.fn(async () => json(me));
    const client = createApiClient({ fetch: fetchMock as unknown as typeof fetch, getToken: () => TOKEN });
    await expect(client.getMe()).resolves.toEqual(me);
    expect(sentHeaders(fetchMock).get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("sends an explicit token instead of the saved one", async () => {
    const fetchMock = vi.fn(async () => json(me));
    const client = createApiClient({ fetch: fetchMock as unknown as typeof fetch, getToken: () => "saved-one" });
    await client.getMe(TOKEN);
    expect(sentHeaders(fetchMock).get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("sends no Authorization header when nothing is saved", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true, version: "x" }));
    const client = createApiClient({ fetch: fetchMock as unknown as typeof fetch, getToken: () => null });
    await client.getHealth();
    expect(sentHeaders(fetchMock).has("authorization")).toBe(false);
  });

  it("reports a 401 as an unauthorized error and never logs the token", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const envelope = { error: { code: "unauthorized", message: "Missing or invalid token." }, requestId: "r" };
    const client = createApiClient({ fetch: async () => json(envelope, { status: 401 }), getToken: () => TOKEN });
    await expect(client.getMe()).rejects.toMatchObject({ code: "unauthorized", status: 401 });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
  });
});

describe("lookup", () => {
  const request = { lang: "zh" as const, word: "出口", sentence: "出口在左边。" };
  const response = {
    surface: "出口",
    headword: "出口",
    pos: "noun",
    gender: null,
    pinyin: "chū kǒu",
    meaningInContext: "exit",
    otherMeanings: [],
    note: null,
    cached: false,
    requestId: "r1",
  };
  const clientFor = (fetchMock: ReturnType<typeof vi.fn>) =>
    createApiClient({ fetch: fetchMock as unknown as typeof fetch, getToken: () => null });

  it("posts the word and sentence as JSON and validates the reply", async () => {
    const fetchMock = vi.fn(async () => json(response));
    await expect(clientFor(fetchMock).lookup(request)).resolves.toMatchObject({ headword: "出口", cached: false });
    const [path, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe("/api/lookup");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("rejects a reply that breaks the contract", async () => {
    const client = clientFor(vi.fn(async () => json({ ...response, pos: "banana" })));
    await expect(client.lookup(request)).rejects.toMatchObject({ code: "bad_response" });
  });

  it("reports a cancelled request as aborted, without logging an error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const controller = new AbortController();
    const fetchMock = vi.fn(async (_path: string, init: RequestInit) => {
      controller.abort();
      return Promise.reject(new DOMException("aborted", "AbortError")).catch((e: unknown) => {
        expect(init.signal?.aborted).toBe(true);
        throw e;
      });
    });
    await expect(clientFor(fetchMock).lookup(request, { signal: controller.signal })).rejects.toMatchObject({
      code: "aborted",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("sends the last photo's read time once, on the next request", async () => {
    const fetchMock = vi.fn(async () => json(response));
    const client = clientFor(fetchMock);
    client.noteOcrMs(1234.4);
    await client.lookup(request);
    await client.lookup(request);
    const sent = (i: number) => new Headers((fetchMock.mock.calls[i] as unknown as [string, RequestInit])[1].headers);
    expect(sent(0).get("x-ocr-ms")).toBe("1234");
    expect(sent(1).has("x-ocr-ms")).toBe(false);
  });
});
