// M0 auth: one shared test token (M0_TOKEN)
//
// Replaced by per-user invite tokens in M3
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { apiError } from "./errors.ts";

const encoder = new TextEncoder();

/** Constant-time string comparison, so response timing doesn't leak the token. */
function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;
  return crypto.subtle.timingSafeEqual(left, right);
}

export const requireM0Token: MiddlewareHandler<AppEnv> = async (c, next) => {
  const expected = c.env.M0_TOKEN;
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !token || !safeEqual(token, expected)) {
    return apiError(c, 401, "unauthorized", "Missing or invalid token.");
  }
  await next();
};
