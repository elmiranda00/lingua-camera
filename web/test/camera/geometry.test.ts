import { describe, expect, it } from "vitest";
import { fitSize, quadToCss } from "../../src/camera/geometry.ts";

describe("fitSize", () => {
  it("scales the long side down to 1600", () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales", () => {
    expect(fitSize(900, 1600)).toEqual({ width: 900, height: 1600 });
    expect(fitSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("accepts another limit", () => {
    expect(fitSize(2000, 1000, 500)).toEqual({ width: 500, height: 250 });
  });
});

describe("quadToCss", () => {
  it("converts an upright quad", () => {
    const box = quadToCss([[100, 50], [300, 50], [300, 90], [100, 90]], 0.5);
    expect(box).toEqual({ left: 50, top: 25, width: 100, height: 20, angle: 0 });
  });

  it("gives the rotation of a tilted quad", () => {
    // top edge runs 100 right and 100 down (y grows downward): 45 degrees
    const box = quadToCss([[0, 0], [100, 100], [60, 140], [-40, 40]], 1);
    expect(box.angle).toBeCloseTo(45, 5);
    expect(box.width).toBeCloseTo(Math.hypot(100, 100), 5);
    expect(box.height).toBeCloseTo(Math.hypot(40, 40), 5);
  });

  it("keeps a vertical word box tall", () => {
    const box = quadToCss([[10, 0], [50, 0], [50, 200], [10, 200]], 1);
    expect(box.width).toBe(40);
    expect(box.height).toBe(200);
  });
});
