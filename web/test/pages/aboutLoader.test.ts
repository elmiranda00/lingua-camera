import { afterEach, describe, expect, it, vi } from "vitest";
import { aboutLoader } from "../../src/pages/aboutLoader.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("aboutLoader", () => {
  it("returns the API version", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ok: true, version: "v9" }));
    await expect(aboutLoader()).resolves.toEqual({ version: "v9" });
  });

  it("returns null instead of throwing when the API is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(aboutLoader()).resolves.toEqual({ version: null });
  });
});
