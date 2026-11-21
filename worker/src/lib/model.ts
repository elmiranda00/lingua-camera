// Lookup model call
//
// Returns only Zod-validated results; retries per LOOKUP_LLM.maxAttempts
import { LookupResult, type LookupRequest } from "@lingua-camera/shared";
import type { ModelRunner } from "../env.ts";
import type { LookupLlmConfig } from "../llm.ts";

export type LookupOutcome =
  | { ok: true; result: LookupResult; attempts: number; modelMs: number }
  | { ok: false; reason: string; attempts: number; modelMs: number };

/** Pulls the reply text out of either Workers AI response shape. */
export function replyText(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const o = output as {
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
  };
  if (typeof o.response === "string") return o.response;
  // JSON mode can return the parsed object directly.
  if (typeof o.response === "object" && o.response !== null) return JSON.stringify(o.response);
  const content = o.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : null;
}

/**
 * Log reason for a thrown model call: name plus Workers AI's numeric code (e.g. 5028 = model deprecated).
 * Only the leading code is kept: the rest of the message is never logged.
 */
export function modelThrew(err: unknown): string {
  if (!(err instanceof Error)) return "model_threw";
  const code = /^(?:\w+:\s*)?(\d{3,5}):/.exec(err.message)?.[1];
  return code ? `model_threw:${err.name}:${code}` : `model_threw:${err.name}`;
}

/** Strips any thinking block and code fences, then parses the outermost JSON object. */
export function parseLookupReply(text: string): LookupResult | null {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = LookupResult.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export async function runLookup(
  ai: ModelRunner,
  model: string,
  config: LookupLlmConfig,
  req: LookupRequest,
): Promise<LookupOutcome> {
  const input = {
    messages: [
      { role: "system", content: config.prompt.text },
      { role: "user", content: JSON.stringify(req) },
    ],
    chat_template_kwargs: config.chatTemplateKwargs,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  };

  const started = Date.now();
  let reason = "no attempts";
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const text = replyText(await ai.run(model, input));
      const result = text === null ? null : parseLookupReply(text);
      if (result) {
        return { ok: true, result, attempts: attempt, modelMs: Date.now() - started };
      }
      reason = text === null ? "empty_reply" : "invalid_json";
    } catch (err) {
      reason = modelThrew(err);
    }
  }
  return { ok: false, reason, attempts: config.maxAttempts, modelMs: Date.now() - started };
}
