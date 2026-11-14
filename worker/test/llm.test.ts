// The live prompt is a versioned file, and its version string is what goes in logs and cache keys
import { describe, expect, it } from "vitest";
import lookupV1 from "../prompts/lookup.v1.md";
import { LOOKUP_LLM } from "../src/llm.ts";

describe("lookup prompt", () => {
  it("serves the versioned file, with its version in the config", () => {
    expect(LOOKUP_LLM.prompt.version).toBe("lookup.v1");
    expect(LOOKUP_LLM.prompt.text).toBe(lookupV1);
  });

  it("asks for every LookupResult field", () => {
    for (const field of ["surface", "headword", "pos", "gender", "pinyin", "meaningInContext", "otherMeanings", "note"]) {
      expect(lookupV1).toContain(`"${field}"`);
    }
  });
});
