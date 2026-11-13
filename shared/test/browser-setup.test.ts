// Import order matters here: the setup module must load before the schemas
import "../src/browser-setup.ts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Health } from "../src/schemas.ts";

describe("browser-setup", () => {
  it("turns on jitless mode, and schemas still validate", () => {
    expect(z.config().jitless).toBe(true);
    expect(Health.safeParse({ ok: true, version: "x" }).success).toBe(true);
    expect(Health.safeParse({ ok: false }).success).toBe(false);
  });
});
