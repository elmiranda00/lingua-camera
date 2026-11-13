// Pinch and pan math. Content is drawn as translate(x, y) scale(scale) with the origin at its top-left
export interface Transform {
  scale: number;
  x: number;
  y: number;
}
export interface View {
  width: number;
  height: number;
}

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Keeps the content covering the view (no empty edges)
export function clampTransform(t: Transform, view: View): Transform {
  const scale = clamp(t.scale, MIN_SCALE, MAX_SCALE);
  return {
    scale,
    x: clamp(t.x, view.width * (1 - scale), 0),
    y: clamp(t.y, view.height * (1 - scale), 0),
  };
}

// Zooms by a factor while the content point under (cx, cy) stays under it
export function zoomAbout(t: Transform, factor: number, cx: number, cy: number, view: View): Transform {
  const scale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
  const px = (cx - t.x) / t.scale;
  const py = (cy - t.y) / t.scale;
  return clampTransform({ scale, x: cx - px * scale, y: cy - py * scale }, view);
}

export function panBy(t: Transform, dx: number, dy: number, view: View): Transform {
  return clampTransform({ ...t, x: t.x + dx, y: t.y + dy }, view);
}
