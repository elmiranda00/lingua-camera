import { describe, expect, it, vi } from "vitest";
import type { LookupRequest, LookupResult } from "@lingua-camera/shared";
import { ApiRequestError } from "../../src/api/client.ts";
import {
  createLookupController,
  failureOf,
  FAILURE_MESSAGE,
  type LookupDeps,
  type SheetState,
} from "../../src/lookup/lookupController.ts";

const result = (overrides: Partial<LookupResult> = {}): LookupResult => ({
  surface: "出口",
  headword: "出口",
  pos: "noun",
  gender: null,
  pinyin: "chu kou (model)",
  meaningInContext: "exit",
  otherMeanings: [],
  note: null,
  ...overrides,
});

const req = (word = "出口", sentence = "出口在左边。"): LookupRequest => ({ lang: "zh", word, sentence });

function setup(overrides: Partial<LookupDeps> = {}) {
  const states: SheetState[] = [];
  const deps: LookupDeps = {
    lookup: vi.fn(async () => result()),
    pinyin: vi.fn(async () => "chū kǒu"),
    ...overrides,
  };
  const controller = createLookupController(deps, (s) => states.push(s));
  return { deps, controller, states, last: () => states.at(-1) };
}

/** A lookup that finishes when the test says so. */
function deferred() {
  let resolve!: (r: LookupResult) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<LookupResult>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("a lookup", () => {
  it("goes from loading to ready, with pinyin-pro's pinyin", async () => {
    const { controller, states } = setup();
    await controller.start(req());
    expect(states.map((s) => s.status)).toEqual(["loading", "ready"]);
    expect(states[0]).toEqual({ status: "loading", word: "出口" });
    const ready = states[1];
    expect(ready?.status === "ready" && ready.info.pinyin).toBe("chū kǒu");
    expect(ready?.status === "ready" && ready.info.result.meaningInContext).toBe("exit");
  });

  it("shows the meaning and pinyin together: nothing is ready until both have arrived", async () => {
    const slowPinyin = deferred();
    const { controller, last } = setup({ pinyin: () => slowPinyin.promise.then(() => "chū kǒu") });
    const done = controller.start(req());
    await Promise.resolve();
    expect(last()?.status).toBe("loading"); // the meaning is back, the pinyin is not
    slowPinyin.resolve(result());
    await done;
    expect(last()?.status).toBe("ready");
  });

  it("falls back to the model's pinyin when pinyin-pro isn't available", async () => {
    const { controller, last } = setup({ pinyin: async () => null });
    await controller.start(req());
    const state = last();
    expect(state?.status === "ready" && state.info.pinyin).toBe("chu kou (model)");
  });

  it("sends the request as given", async () => {
    const { controller, deps } = setup();
    await controller.start(req("出口", "出口在左边。"));
    expect(deps.lookup).toHaveBeenCalledWith({ lang: "zh", word: "出口", sentence: "出口在左边。" }, expect.any(AbortSignal));
  });
});

describe("failures", () => {
  it.each([
    ["unauthorized", "sign_in"],
    ["rate_limited", "limit"],
    ["model_error", "other"],
    ["network", "other"],
    ["timeout", "other"],
    ["bad_response", "other"],
  ] as const)("maps %s to %s", (code, failure) => {
    expect(failureOf(new ApiRequestError(code, "x", null, null))).toBe(failure);
  });

  it("maps anything else to other", () => {
    expect(failureOf(new Error("boom"))).toBe("other");
  });

  it("shows the failure, and Retry asks again", async () => {
    const lookup = vi
      .fn()
      .mockRejectedValueOnce(new ApiRequestError("model_error", "x", 502, null))
      .mockResolvedValueOnce(result());
    const { controller, last } = setup({ lookup });
    await controller.start(req());
    expect(last()).toEqual({ status: "error", word: "出口", failure: "other" });
    await controller.retry();
    expect(last()?.status).toBe("ready");
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("states the daily limit in UTC", () => {
    expect(FAILURE_MESSAGE.limit).toContain("00:00 UTC");
    expect(FAILURE_MESSAGE.limit).not.toMatch(/Paris|Beijing/);
  });
});

describe("switching words", () => {
  it("drops an older lookup when another word is tapped", async () => {
    const first = deferred();
    const lookup = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(result({ meaningInContext: "second" }));
    const { controller, last } = setup({ lookup });

    const slow = controller.start(req("出口"));
    await controller.start(req("入口"));
    first.resolve(result({ meaningInContext: "first" }));
    await slow;

    const state = last();
    expect(state?.status === "ready" && state.info.result.meaningInContext).toBe("second");
  });

  it("aborts the older request", async () => {
    const signals: AbortSignal[] = [];
    const lookup = vi.fn(async (_req: LookupRequest, signal: AbortSignal) => {
      signals.push(signal);
      return result();
    });
    const { controller } = setup({ lookup });
    void controller.start(req("出口"));
    void controller.start(req("入口"));
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
  });

  it("ignores a failure from a request that was replaced", async () => {
    const first = deferred();
    const lookup = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValueOnce(result());
    const { controller, last } = setup({ lookup });
    const slow = controller.start(req("出口"));
    await controller.start(req("入口"));
    first.reject(new ApiRequestError("aborted", "x", null, null));
    await slow;
    expect(last()?.status).toBe("ready");
  });

  it("does nothing when the word already shown is tapped again", async () => {
    const { controller, deps, states } = setup();
    await controller.start(req());
    const before = states.length;
    await controller.start(req());
    expect(states).toHaveLength(before);
    expect(deps.lookup).toHaveBeenCalledTimes(1);
  });
});

describe("the per-photo cache", () => {
  it("answers a repeated word without another request", async () => {
    const { controller, deps, last } = setup();
    await controller.start(req("出口"));
    await controller.start(req("入口"));
    await controller.start(req("出口"));
    expect(deps.lookup).toHaveBeenCalledTimes(2);
    expect(last()?.status).toBe("ready");
  });

  it("treats the same word in a different sentence as a new lookup", async () => {
    const { controller, deps } = setup();
    await controller.start(req("行", "银行在左边。"));
    await controller.start(req("行", "他行走很快。"));
    expect(deps.lookup).toHaveBeenCalledTimes(2);
  });

  it("keeps results after close, and forgets them on reset", async () => {
    const { controller, deps, last } = setup();
    await controller.start(req());
    controller.close();
    expect(last()?.status).toBe("idle");
    await controller.start(req());
    expect(deps.lookup).toHaveBeenCalledTimes(1);

    controller.reset();
    await controller.start(req());
    expect(deps.lookup).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures", async () => {
    const lookup = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(result());
    const { controller, last } = setup({ lookup });
    await controller.start(req());
    await controller.start(req()); // same word after an error asks again
    expect(last()?.status).toBe("ready");
  });
});

describe("closing", () => {
  it("cancels a lookup in flight and shows nothing when it later finishes", async () => {
    const pending = deferred();
    const { controller, last } = setup({ lookup: () => pending.promise });
    const run = controller.start(req());
    controller.close();
    pending.resolve(result());
    await run;
    expect(last()?.status).toBe("idle");
  });
});
