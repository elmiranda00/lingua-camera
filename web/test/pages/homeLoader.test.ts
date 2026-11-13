import { afterEach, describe, expect, it, vi } from "vitest";
import { homeLoader } from "../../src/pages/homeLoader.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("homeLoader", () => {
  it("returns the API version", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ ok: true, version: "v9" }));
    await expect(homeLoader()).resolves.toEqual({ version: "v9" });
  });

  it("returns null instead of throwing when the API is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(homeLoader()).resolves.toEqual({ version: null });
  });
});
