// The black camera box before the camera is on: tap the glyph to start it
import { Glyph } from "../brand/Glyph.tsx";

interface Props {
  onStart: () => void;
}

export function StartCamera({ onStart }: Props) {
  return (
    <button type="button" className="camera-start" onClick={onStart} aria-label="Start camera">
      <Glyph size={72} />
      <span className="camera-start-label">Tap to start the camera</span>
    </button>
  );
}
