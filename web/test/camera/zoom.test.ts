import { describe, expect, it } from "vitest";
import { clampTransform, IDENTITY, MAX_SCALE, MIN_SCALE, panBy, zoomAbout } from "../../src/camera/zoom.ts";

const view = { width: 400, height: 600 };

describe("clampTransform", () => {
  it("limits the scale", () => {
    expect(clampTransform({ scale: 99, x: 0, y: 0 }, view).scale).toBe(MAX_SCALE);
    expect(clampTransform({ scale: 0.2, x: 0, y: 0 }, view).scale).toBe(MIN_SCALE);
  });

  it("keeps the content covering the view", () => {
    const t = clampTransform({ scale: 2, x: 50, y: -9999 }, view);
    expect(t.x).toBe(0);
    expect(t.y).toBe(-600); // view.height * (1 - 2)
  });

  it("resets the offset at scale 1", () => {
    expect(clampTransform({ scale: 1, x: -30, y: 40 }, view)).toEqual(IDENTITY);
  });
});

describe("zoomAbout", () => {
  it("keeps the point under the fingers in place", () => {
    const t = zoomAbout(IDENTITY, 2, 200, 300, view);
    expect(t.scale).toBe(2);
    // content point (200,300) is still at screen (200,300): x + 200*2 = 200
    expect(t.x + 200 * t.scale).toBe(200);
    expect(t.y + 300 * t.scale).toBe(300);
  });

  it("stops at the maximum", () => {
    let t = IDENTITY;
    for (let i = 0; i < 10; i++) t = zoomAbout(t, 2, 100, 100, view);
    expect(t.scale).toBe(MAX_SCALE);
  });

  it("zooming out returns to the whole photo", () => {
    const zoomed = zoomAbout(IDENTITY, 3, 120, 80, view);
    expect(zoomAbout(zoomed, 1 / 3, 120, 80, view)).toEqual(IDENTITY);
  });
});

describe("panBy", () => {
  it("does nothing at scale 1", () => {
    expect(panBy(IDENTITY, 50, 50, view)).toEqual(IDENTITY);
  });

  it("moves when zoomed, within the photo's edges", () => {
    const zoomed = { scale: 2, x: -100, y: -100 };
    expect(panBy(zoomed, 30, -20, view)).toEqual({ scale: 2, x: -70, y: -120 });
    expect(panBy(zoomed, 500, 500, view)).toEqual({ scale: 2, x: 0, y: 0 });
  });
});
