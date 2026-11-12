import { describe, expect, it } from "vitest";
import { ApiError, LookupRequest, LookupResult, TtsRequest } from "../src/schemas.ts";

const validResult = {
  surface: "mangeaient",
  headword: "manger",
  pos: "verb",
  gender: null,
  pinyin: null,
  meaningInContext: "(they) were eating",
  otherMeanings: ["to eat", "to use up (money, time)"],
  note: null,
};

describe("LookupRequest", () => {
  it("accepts a valid request", () => {
    expect(
      LookupRequest.parse({ lang: "zh", word: "出口", sentence: "出口在左边。" }),
    ).toEqual({ lang: "zh", word: "出口", sentence: "出口在左边。" });
  });

  it("trims whitespace", () => {
    expect(LookupRequest.parse({ lang: "fr", word: " chat ", sentence: "Le chat." }).word).toBe("chat");
  });

  it.each([
    ["unknown language", { lang: "de", word: "Hund", sentence: "Der Hund." }],
    ["blank word", { lang: "fr", word: "   ", sentence: "Le chat." }],
    ["word over 40 chars", { lang: "fr", word: "a".repeat(41), sentence: "x" }],
    ["sentence over 300 chars", { lang: "fr", word: "a", sentence: "a".repeat(301) }],
  ])("rejects %s", (_label, body) => {
    expect(LookupRequest.safeParse(body).success).toBe(false);
  });
});

describe("LookupResult", () => {
  it("accepts the spec example", () => {
    expect(LookupResult.parse(validResult)).toEqual(validResult);
  });

  it("rejects an unknown part of speech", () => {
    expect(LookupResult.safeParse({ ...validResult, pos: "gerund" }).success).toBe(false);
  });

  it("keeps only the first 3 other meanings", () => {
    const parsed = LookupResult.parse({ ...validResult, otherMeanings: ["a", "b", "c", "d"] });
    expect(parsed.otherMeanings).toEqual(["a", "b", "c"]);
  });

  it("accepts a meaning slightly over the 80-char target", () => {
    expect(
      LookupResult.safeParse({ ...validResult, meaningInContext: "x".repeat(100) }).success,
    ).toBe(true);
  });

  it("rejects a meaning over the 120-char hard cap", () => {
    expect(
      LookupResult.safeParse({ ...validResult, meaningInContext: "x".repeat(121) }).success,
    ).toBe(false);
  });

  it("rejects missing fields", () => {
    const { note: _note, ...rest } = validResult;
    expect(LookupResult.safeParse(rest).success).toBe(false);
  });
});

describe("TtsRequest", () => {
  it("caps text at 40 chars", () => {
    expect(TtsRequest.safeParse({ lang: "zh", text: "字".repeat(41) }).success).toBe(false);
    expect(TtsRequest.safeParse({ lang: "zh", text: "出口" }).success).toBe(true);
  });
});

describe("ApiError", () => {
  it("matches the error envelope", () => {
    expect(
      ApiError.safeParse({ error: { code: "bad_request", message: "x" }, requestId: "r1" }).success,
    ).toBe(true);
  });
});
