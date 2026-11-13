// Error envelope: { error: { code, message }, requestId }
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiError, ErrorCode } from "@lingua-camera/shared";
import type { AppEnv } from "../env.ts";

export function apiError(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
) {
  const body: ApiError = { error: { code, message }, requestId: c.get("requestId") };
  return c.json(body, status);
}
