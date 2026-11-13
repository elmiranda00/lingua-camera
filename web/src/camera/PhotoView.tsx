// The frozen photo with word boxes on top; pinch to zoom
import { useState } from "react";
import type { TieredBox } from "../tiers/tiers.ts";
import { useElementSize } from "./hooks.ts";
import { useZoom } from "./useZoom.ts";
import { WordButton } from "./WordButton.tsx";

interface Props {
  url: string;
  size: { width: number; height: number }; // photo size the boxes are measured in
  boxes: TieredBox[];
  reading: boolean;
  onSelect: (box: TieredBox) => void;
  selected: TieredBox | null;
}

export function PhotoView({ url, size, boxes, reading, onSelect, selected }: Props) {
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  // Largest size that fits the stage with the photo's aspect ratio
  const scale = stage.width > 0 && stage.height > 0 ? Math.min(stage.width / size.width, stage.height / size.height) : 0;
  const view = { width: size.width * scale, height: size.height * scale };
  const zoom = useZoom(view);
  const [failed, setFailed] = useState(false);

  return (
    <div ref={stageRef} className="stage">
      <div className="viewport" style={{ width: view.width, height: view.height }} {...zoom.handlers}>
        <div
          className="content"
          style={{ transform: `translate(${zoom.transform.x}px, ${zoom.transform.y}px) scale(${zoom.transform.scale})` }}
        >
          <img src={url} alt="Your photo" className="photo" draggable={false} onError={() => setFailed(true)} />
          {!reading &&
            boxes.map((box, i) => (
              <WordButton key={i} box={box} scale={scale} selected={selected === box} onSelect={onSelect} />
            ))}
        </div>
      </div>
      {failed && <p role="alert">This photo can't be shown.</p>}
    </div>
  );
}
