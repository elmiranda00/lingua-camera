// POST /api/lookup: translate a word in its sentence
//
// M0: test-token auth, no cache, no daily cap
import { Hono } from "hono";
import { LookupRequest, type LookupResponse } from "@lingua-camera/shared";
import type { AppEnv } from "../env.ts";
import { requireM0Token } from "../lib/auth.ts";
import { readJson } from "../lib/body.ts";
import { apiError } from "../lib/errors.ts";
import { runLookup } from "../lib/model.ts";
import { LOOKUP_LLM } from "../llm.ts";

export const lookup = new Hono<AppEnv>().post("/", requireM0Token, async (c) => {
  const body = await readJson(c, LookupRequest);
  if (!body.ok) return body.response;

  const outcome = await runLookup(c.env.AI, c.env.LOOKUP_MODEL, LOOKUP_LLM, body.data);
  c.set("logExtra", {
    model: c.env.LOOKUP_MODEL,
    prompt: LOOKUP_LLM.prompt.version,
    model_ms: outcome.modelMs,
    attempts: outcome.attempts,
    cached: false,
    ...(outcome.ok ? {} : { error: outcome.reason }),
  });

  if (!outcome.ok) {
    return apiError(c, 502, "model_error", "Couldn't translate right now. Try again.");
  }
  const response: LookupResponse = { ...outcome.result, cached: false, requestId: c.get("requestId") };
  return c.json(response);
});
