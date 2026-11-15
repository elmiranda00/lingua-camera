import { describe, expect, it } from "vitest";
import { START_CAMERA, wantsCameraStart } from "../../src/camera/autoStart.ts";

describe("wantsCameraStart", () => {
  it("is true for the state the welcome screen sends", () => {
    expect(wantsCameraStart(START_CAMERA)).toBe(true);
  });

  it("is false for no state, other state, or a non-true flag", () => {
    for (const state of [null, undefined, "startCamera", {}, { startCamera: "yes" }, { startCamera: 1 }]) {
      expect(wantsCameraStart(state)).toBe(false);
    }
  });
});
