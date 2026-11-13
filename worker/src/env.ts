// Worker bindings and vars (see wrangler.jsonc)
import type { LogFields } from "./lib/log.ts";

/** The slice of Workers AI we use; model is a plain string because it comes from config. */
export interface ModelRunner {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  AI: ModelRunner;
  DB: D1Database;
  ASSETS: Fetcher;
  APP_VERSION: string;
  LOOKUP_MODEL: string;
  TTS_MODEL: string;
  /** M0 only: shared test token for /api/lookup and /api/tts. Set with `wrangler secret put M0_TOKEN`. */
  M0_TOKEN?: string;
}

export interface Vars {
  requestId: string;
  /** Extra fields a route adds to the request's log line (model, timings, ...). */
  logExtra?: Partial<LogFields>;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
