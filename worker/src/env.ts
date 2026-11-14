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
}

export interface AuthUser {
  id: string;
  name: string;
}

export interface Vars {
  requestId: string;
  /** Set by requireUser on authenticated routes. */
  user?: AuthUser;
  /** Total D1 time so far in this request (see lib/db.ts). */
  dbMs?: number;
  /** Extra fields a route adds to the request's log line (model, timings, ...). */
  logExtra?: Partial<LogFields>;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
