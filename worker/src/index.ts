// Worker entry: /api routes, everything else is the web build
import { Hono } from "hono";
import type { AppEnv } from "./env.ts";
import { apiError } from "./lib/errors.ts";
import { log } from "./lib/log.ts";
import { health } from "./routes/health.ts";
import { lookup } from "./routes/lookup.ts";
import { tts } from "./routes/tts.ts";
import { applySecurityHeaders } from "./security.ts";

export const app = new Hono<AppEnv>();

// Request ID, security headers and one log line per API request.
app.use("*", async (c, next) => {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);

  await next();

  // Asset responses can have immutable headers, so copy before editing.
  c.res = new Response(c.res.body, c.res);
  c.res.headers.set("x-request-id", requestId);
  applySecurityHeaders(c.res.headers);

  if (c.req.path.startsWith("/api/")) {
    const ocrMs = Number(c.req.header("x-ocr-ms"));
    log({
      requestId,
      route: `${c.req.method} ${c.req.routePath}`,
      status: c.res.status,
      total_ms: Date.now() - started,
      ...(Number.isFinite(ocrMs) && ocrMs > 0 ? { ocr_ms: ocrMs } : {}),
      ...c.get("logExtra"),
    });
  }
});

app.route("/api/health", health);
app.route("/api/lookup", lookup);
app.route("/api/tts", tts);
app.all("/api/*", (c) => apiError(c, 404, "not_found", "No such endpoint."));

// Everything else is the web app.
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  c.set("logExtra", { error: err.name });
  return apiError(c, 500, "internal", "Something went wrong.");
});

export default app;
