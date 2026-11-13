// Pinch, drag and wheel zoom for the photo (math lives in zoom.ts)
import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { clampTransform, IDENTITY, panBy, zoomAbout, type Transform, type View } from "./zoom.ts";

const DRAG_THRESHOLD = 6; // px before a one-finger move counts as a drag, so taps still work

interface Pointer {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export function useZoom(view: View) {
  const [transform, setTransform] = useState<Transform>(IDENTITY);
  const pointers = useRef(new Map<number, Pointer>());
  const dragged = useRef(false);

  const local = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return {
    // Kept valid if the view changes size (e.g. the phone rotates)
    transform: clampTransform(transform, view),
    // Spread onto the element that receives gestures
    handlers: {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        const p = local(e);
        pointers.current.set(e.pointerId, { ...p, startX: p.x, startY: p.y });
        dragged.current = false;
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const map = pointers.current;
        const prev = map.get(e.pointerId);
        if (!prev) return;
        const cur = local(e);
        if (map.size === 2) {
          const other = [...map.entries()].find(([id]) => id !== e.pointerId)![1];
          const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
          const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
          const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
          const m1 = { x: (cur.x + other.x) / 2, y: (cur.y + other.y) / 2 };
          if (d0 > 0) {
            setTransform((t) => panBy(zoomAbout(t, d1 / d0, m1.x, m1.y, view), m1.x - m0.x, m1.y - m0.y, view));
          }
          dragged.current = true;
        } else if (map.size === 1) {
          const moved = Math.hypot(cur.x - prev.startX, cur.y - prev.startY);
          if (dragged.current || moved > DRAG_THRESHOLD) {
            setTransform((t) => panBy(t, cur.x - prev.x, cur.y - prev.y, view));
            dragged.current = true;
          }
        }
        map.set(e.pointerId, { ...prev, x: cur.x, y: cur.y });
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        pointers.current.delete(e.pointerId);
        // A drag must not also count as a tap on the box underneath
        if (pointers.current.size === 0) setTimeout(() => (dragged.current = false), 0);
      },
      onPointerCancel(e: PointerEvent<HTMLElement>) {
        pointers.current.delete(e.pointerId);
        dragged.current = false;
      },
      onClickCapture(e: { stopPropagation(): void; preventDefault(): void }) {
        if (dragged.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      onWheel(e: WheelEvent<HTMLElement>) {
        const p = local(e);
        setTransform((t) => zoomAbout(t, Math.exp(-e.deltaY * 0.0015), p.x, p.y, view));
      },
    },
  };
}
