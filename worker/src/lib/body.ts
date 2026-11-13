// Reads a JSON body: size limit, then Zod schema
import type { Context } from "hono";
import type { z } from "zod";
import type { AppEnv } from "../env.ts";
import { LIMITS } from "../limits.ts";
import { apiError } from "./errors.ts";

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

export async function readJson<S extends z.ZodType>(
  c: Context<AppEnv>,
  schema: S,
): Promise<BodyResult<z.infer<S>>> {
  const declared = Number(c.req.header("content-length") ?? "0");
  if (declared > LIMITS.bodyMaxBytes) {
    return { ok: false, response: apiError(c, 413, "payload_too_large", "Request body too large.") };
  }
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > LIMITS.bodyMaxBytes) {
    return { ok: false, response: apiError(c, 413, "payload_too_large", "Request body too large.") };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, response: apiError(c, 400, "bad_request", "Body must be JSON.") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") || "body";
    return { ok: false, response: apiError(c, 400, "bad_request", `Invalid field: ${field}.`) };
  }
  return { ok: true, data: parsed.data };
}
