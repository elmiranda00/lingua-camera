// One tappable box over a word, styled by tier
import type { CSSProperties } from "react";
import type { TieredBox } from "../tiers/tiers.ts";
import { quadToCss } from "./geometry.ts";

interface Props {
  box: TieredBox;
  scale: number; // display px per photo px
  selected: boolean;
  onSelect: (box: TieredBox) => void;
}

const TIER_LABEL = { saved: ", saved", key: ", key word", normal: "" } as const;

export function WordButton({ box, scale, selected, onSelect }: Props) {
  const { left, top, width, height, angle } = quadToCss(box.quad, scale);
  // Outline thickness follows the box size, so dense small text doesn't turn into a blob
  const outline = Math.min(3, Math.max(1.5, Math.min(width, height) * 0.09));
  return (
    <button
      type="button"
      className={`word word-${box.tier}${selected ? " word-selected" : ""}`}
      style={
        {
          left,
          top,
          width,
          height,
          transform: `rotate(${angle}deg)`,
          "--outline": `${outline}px`,
        } as CSSProperties
      }
      aria-label={`${box.text}${TIER_LABEL[box.tier]}`}
      aria-pressed={selected}
      onClick={() => onSelect(box)}
    />
  );
}
