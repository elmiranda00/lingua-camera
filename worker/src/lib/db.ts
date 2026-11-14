// Times D1 calls; the total goes in the request's log line as db_ms
//
// Work done after the response (cache writes) is not counted
import type { Context } from "hono";
import type { AppEnv } from "../env.ts";

export async function timed<T>(c: Context<AppEnv>, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await work();
  } finally {
    c.set("dbMs", (c.get("dbMs") ?? 0) + (Date.now() - started));
  }
}
