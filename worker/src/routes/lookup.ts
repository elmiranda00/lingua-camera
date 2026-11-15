// POST /api/lookup: translate a word in its sentence
//
// Order: validate, cache, daily cap (cache hits are free), model, cache write after the response
import { Hono } from "hono";
import { LookupRequest, type LookupResponse, type LookupResult } from "@lingua-camera/shared";
import type { AppEnv } from "../env.ts";
import { requireUser } from "../lib/auth.ts";
import { readJson } from "../lib/body.ts";
import { cacheKey, readCache, writeCache } from "../lib/cache.ts";
import { timed } from "../lib/db.ts";
import { apiError } from "../lib/errors.ts";
import { runLookup } from "../lib/model.ts";
import { release, reserve } from "../lib/usage.ts";
import { LOOKUP_LLM } from "../llm.ts";
import { LIMITS } from "../limits.ts";

export const lookup = new Hono<AppEnv>().post("/", requireUser, async (c) => {
  const body = await readJson(c, LookupRequest);
  if (!body.ok) return body.response;
  const user = c.get("user");
  if (!user) return apiError(c, 401, "unauthorized", "Missing or invalid token.");

  const model = c.env.LOOKUP_MODEL;
  const prompt = LOOKUP_LLM.prompt.version;
  const lang = body.data.lang;
  const respond = (result: LookupResult, cached: boolean) => {
    const response: LookupResponse = { ...result, cached, requestId: c.get("requestId") };
    return c.json(response);
  };

  const key = await cacheKey(body.data, model, prompt);
  const hit = await timed(c, () => readCache(c.env.DB, key));
  if (hit) {
    c.set("logExtra", { lang, model, prompt, cached: true });
    return respond(hit, true);
  }

  const allowed = await timed(c, () => reserve(c.env.DB, user.id, "lookups", LIMITS.lookupsPerDay));
  if (!allowed) {
    c.set("logExtra", { lang, model, prompt, cached: false, error: "daily_limit" });
    return apiError(c, 429, "rate_limited", "Daily limit reached, resets at 00:00 UTC.");
  }

  const outcome = await runLookup(c.env.AI, model, LOOKUP_LLM, body.data);
  c.set("logExtra", {
    lang,
    model,
    prompt,
    model_ms: outcome.modelMs,
    attempts: outcome.attempts,
    cached: false,
    ...(outcome.ok ? {} : { error: outcome.reason }),
  });

  if (!outcome.ok) {
    // The user got nothing for this slot
    c.executionCtx.waitUntil(release(c.env.DB, user.id, "lookups").catch(() => {}));
    return apiError(c, 502, "model_error", "Couldn't translate right now. Try again.");
  }

  c.executionCtx.waitUntil(writeCache(c.env.DB, key, outcome.result).catch(() => {}));
  return respond(outcome.result, false);
});
