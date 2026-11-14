// GET /api/me: who the token belongs to
import { Hono } from "hono";
import type { Me } from "@lingua-camera/shared";
import type { AppEnv } from "../env.ts";
import { requireUser } from "../lib/auth.ts";
import { apiError } from "../lib/errors.ts";

export const me = new Hono<AppEnv>().get("/", requireUser, (c) => {
  const user = c.get("user");
  if (!user) return apiError(c, 401, "unauthorized", "Missing or invalid token.");
  const body: Me = { id: user.id, name: user.name };
  return c.json(body);
});
