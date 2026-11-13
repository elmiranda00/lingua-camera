// POST /api/tts: MeloTTS speech fallback (MP3)
import { Hono } from "hono";
import { TtsRequest } from "@lingua-camera/shared";
import type { AppEnv } from "../env.ts";
import { requireM0Token } from "../lib/auth.ts";
import { readJson } from "../lib/body.ts";
import { apiError } from "../lib/errors.ts";

/** Decodes base64 into bytes. */
function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const tts = new Hono<AppEnv>().post("/", requireM0Token, async (c) => {
  const body = await readJson(c, TtsRequest);
  if (!body.ok) return body.response;

  const started = Date.now();
  let audio: unknown;
  try {
    const out = await c.env.AI.run(c.env.TTS_MODEL, { prompt: body.data.text, lang: body.data.lang });
    audio = (out as { audio?: unknown } | null)?.audio;
  } catch (err) {
    c.set("logExtra", {
      model: c.env.TTS_MODEL,
      model_ms: Date.now() - started,
      error: err instanceof Error ? `model_threw:${err.name}` : "model_threw",
    });
    return apiError(c, 502, "model_error", "Speech isn't available for this language.");
  }
  c.set("logExtra", { model: c.env.TTS_MODEL, model_ms: Date.now() - started });

  if (typeof audio !== "string" || audio.length === 0) {
    return apiError(c, 502, "model_error", "Speech isn't available for this language.");
  }
  return new Response(fromBase64(audio), { headers: { "content-type": "audio/mpeg" } });
});
