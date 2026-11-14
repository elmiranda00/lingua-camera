// Per-user auth: Bearer token, SHA-256 matched against users.token_hash
//
// Unknown and disabled users both get the same 401
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.ts";
import { timed } from "./db.ts";
import { apiError } from "./errors.ts";
import { sha256Hex } from "./hash.ts";

/** Tokens are 43 characters (32 bytes, base64url); anything much longer isn't one. */
const TOKEN_MAX_CHARS = 128;

/** SHA-256 of the token as lowercase hex (what users.token_hash stores). */
export const hashToken = sha256Hex;

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token.length > TOKEN_MAX_CHARS) {
    return apiError(c, 401, "unauthorized", "Missing or invalid token.");
  }

  const tokenHash = await hashToken(token);
  const user = await timed(c, () =>
    c.env.DB.prepare("SELECT id, name FROM users WHERE token_hash = ? AND disabled = 0")
      .bind(tokenHash)
      .first<{ id: string; name: string }>(),
  );
  if (!user) return apiError(c, 401, "unauthorized", "Missing or invalid token.");

  c.set("user", user);
  await next();
};
