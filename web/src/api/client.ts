// API client
//
// Every response is validated with a shared Zod schema. Failures become ApiRequestError
// and log the request ID only (never bodies, words, sentences or tokens).
import { ApiError, Health, Me, type ErrorCode } from "@lingua-camera/shared";
import { tokenStore } from "../auth/token.ts";

/** Anything with Zod's safeParse shape. */
export interface Parser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

export type ApiFailure = ErrorCode | "network" | "timeout" | "bad_response";

export class ApiRequestError extends Error {
  readonly code: ApiFailure;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(code: ApiFailure, message: string, status: number | null, requestId: string | null) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export interface ApiClientOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** The saved sign-in token, sent as a Bearer header when there is one. */
  getToken?: () => string | null;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createApiClient(options: ApiClientOptions = {}) {
  // Looked up at call time so tests can swap the global fetch
  const fetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const getToken = options.getToken ?? (() => tokenStore.read());

  function fail(path: string, error: ApiRequestError): ApiRequestError {
    console.error("API request failed", {
      path,
      code: error.code,
      status: error.status,
      requestId: error.requestId,
    });
    return error;
  }

  async function request<T>(path: string, parser: Parser<T>, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const token = getToken();
    if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);

    let res: Response;
    try {
      res = await fetchFn(path, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      throw fail(
        path,
        new ApiRequestError(
          timedOut ? "timeout" : "network",
          timedOut ? "The request timed out." : "Couldn't reach the server.",
          null,
          null,
        ),
      );
    }

    const headerId = res.headers.get("x-request-id");
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // Non-JSON body: handled as a bad response below
    }

    if (!res.ok) {
      const envelope = ApiError.safeParse(body);
      throw fail(
        path,
        envelope.success
          ? new ApiRequestError(
              envelope.data.error.code,
              envelope.data.error.message,
              res.status,
              headerId ?? envelope.data.requestId,
            )
          : new ApiRequestError("bad_response", `HTTP ${res.status}`, res.status, headerId),
      );
    }

    const parsed = parser.safeParse(body);
    if (!parsed.success) {
      throw fail(
        path,
        new ApiRequestError("bad_response", "Unexpected response from the server.", res.status, headerId),
      );
    }
    return parsed.data;
  }

  return {
    getHealth: () => request("/api/health", Health),
    /** Who a token belongs to; pass a token to check one that isn't saved yet. */
    getMe: (token?: string) =>
      request("/api/me", Me, token ? { headers: { authorization: `Bearer ${token}` } } : undefined),
  };
}

export const api = createApiClient();
