// Logo: glyph + "Lingua Camera" wordmark (spec in docs/brand/README.md)
import { Glyph } from "../brand/Glyph.tsx";

export function BrandMark() {
  return (
    <header className="welcome-brand">
      <Glyph size={32} className="welcome-brand-glyph" />
      <span className="welcome-wordmark">
        <span className="welcome-wordmark-lingua">Lingua</span> Camera
      </span>
    </header>
  );
}
