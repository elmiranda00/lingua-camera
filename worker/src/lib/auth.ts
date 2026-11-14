// Per-user auth: Bearer token, SHA-256 matched against users.token_hash
//
// Unknown and disabled users both get the same 401
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { apiError } from "./errors.ts";

const encoder = new TextEncoder();

/** Tokens are 43 characters (32 bytes, base64url); anything much longer isn't one. */
const TOKEN_MAX_CHARS = 128;

/** SHA-256 of the token as lowercase hex (what users.token_hash stores). */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > TOKEN_MAX_CHARS) {
    return apiError(c, 401, "unauthorized", "Missing or invalid token.");
  }

  const user = await c.env.DB.prepare("SELECT id, name FROM users WHERE token_hash = ? AND disabled = 0")
    .bind(await hashToken(token))
    .first<{ id: string; name: string }>();
  if (!user) return apiError(c, 401, "unauthorized", "Missing or invalid token.");

  c.set("user", user);
  await next();
};
