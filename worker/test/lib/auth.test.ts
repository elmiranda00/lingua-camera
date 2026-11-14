// hashToken matches standard SHA-256 (the user-add script hashes with node:crypto)
import { describe, expect, it } from "vitest";
import { hashToken } from "../../src/lib/auth.ts";

describe("hashToken", () => {
  it("returns lowercase hex SHA-256", async () => {
    expect(await hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
