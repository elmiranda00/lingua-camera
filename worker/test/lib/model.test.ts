import { describe, expect, it } from "vitest";
import { parseLookupReply, replyText } from "../../src/lib/model.ts";

const result = {
  surface: "mangeaient",
  headword: "manger",
  pos: "verb",
  gender: null,
  pinyin: null,
  meaningInContext: "(they) were eating",
  otherMeanings: ["to eat"],
  note: null,
};

describe("replyText", () => {
  it("reads the classic { response } shape", () => {
    expect(replyText({ response: "hi" })).toBe("hi");
  });
  it("reads the OpenAI-style choices shape", () => {
    expect(replyText({ choices: [{ message: { content: "hi" } }] })).toBe("hi");
  });
  it("re-serialises an already-parsed JSON response", () => {
    expect(JSON.parse(replyText({ response: result }) ?? "")).toEqual(result);
  });
  it("returns null for anything else", () => {
    expect(replyText(null)).toBeNull();
    expect(replyText({ foo: 1 })).toBeNull();
  });
});

describe("parseLookupReply", () => {
  it("parses plain JSON", () => {
    expect(parseLookupReply(JSON.stringify(result))).toEqual(result);
  });
  it("ignores a thinking block and code fences", () => {
    const text = "<think>hmm</think>\n```json\n" + JSON.stringify(result) + "\n```";
    expect(parseLookupReply(text)).toEqual(result);
  });
  it("rejects JSON that breaks the contract", () => {
    expect(parseLookupReply(JSON.stringify({ ...result, pos: "gerund" }))).toBeNull();
  });
  it("rejects non-JSON", () => {
    expect(parseLookupReply("I don't know")).toBeNull();
    expect(parseLookupReply("{ not json }")).toBeNull();
  });
});
