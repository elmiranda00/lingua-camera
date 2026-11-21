import { describe, expect, it, vi } from "vitest";
import { modelThrew, parseLookupReply, replyText, runLookup } from "../../src/lib/model.ts";
import { LOOKUP_LLM } from "../../src/llm.ts";

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

describe("modelThrew", () => {
  it("keeps the Workers AI error code but not the message", () => {
    const err = new Error("5028: @cf/x was deprecated on 2026-11-20.");
    err.name = "AiError";
    expect(modelThrew(err)).toBe("model_threw:AiError:5028");
  });
  it("reads the code after an 'AiError:' prefix", () => {
    expect(modelThrew(new Error("AiError: 3036: limit"))).toBe("model_threw:Error:3036");
  });
  it("falls back to the name, or nothing, without a code", () => {
    expect(modelThrew(new TypeError("bad sentence text"))).toBe("model_threw:TypeError");
    expect(modelThrew("boom")).toBe("model_threw");
  });
});

describe("runLookup", () => {
  it("turns thinking off and sends the request as the user message", async () => {
    const run = vi.fn().mockResolvedValue({ response: JSON.stringify(result) });
    const req = { lang: "fr", word: "mangeaient", sentence: "Ils mangeaient." } as const;
    const outcome = await runLookup({ run }, "m", LOOKUP_LLM, req);
    expect(outcome.ok).toBe(true);
    const input = run.mock.calls[0]?.[1] as { chat_template_kwargs: unknown; messages: { content: string }[] };
    expect(input.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(input.messages[1]?.content).toBe(JSON.stringify(req));
  });
});
