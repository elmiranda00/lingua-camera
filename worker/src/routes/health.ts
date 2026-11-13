// GET /api/health (no auth)
import { Hono } from "hono";
import type { Health } from "@lingua-camera/shared";
import type { AppEnv } from "../env.ts";

export const health = new Hono<AppEnv>().get("/", (c) => {
  const body: Health = { ok: true, version: c.env.APP_VERSION };
  return c.json(body);
});
