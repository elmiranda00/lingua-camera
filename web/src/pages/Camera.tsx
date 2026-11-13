// Camera page (home): viewfinder → photo → word boxes
import type { Lang } from "@lingua-camera/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import "../camera/camera.css";
import { useLang, useWarmUp } from "../camera/hooks.ts";
import { LangChip } from "../camera/LangChip.tsx";
import { ModelStatus } from "../camera/ModelStatus.tsx";
import { captureFrame, toOcrBitmap } from "../camera/photo.ts";
import { PhotoPickers } from "../camera/PhotoPickers.tsx";
import { PhotoView } from "../camera/PhotoView.tsx";
import { Viewfinder } from "../camera/Viewfinder.tsx";
import { getLang } from "../lang/index.ts";
import { recognize } from "../ocr/engine.ts";
import { tierBoxes, type TieredBox } from "../tiers/tiers.ts";

interface Photo {
  blob: Blob;
  url: string;
}
// Photo size (the size OCR works in) is known once the photo has been decoded
type Size = { width: number; height: number };
type Phase =
  | { kind: "live" }
  | { kind: "reading"; photo: Photo; size?: Size }
  | { kind: "result"; photo: Photo; size: Size; boxes: TieredBox[]; ms: number }
  | { kind: "error"; photo: Photo; size?: Size };

export function Camera() {
  const [lang, setLang] = useLang();
  const progress = useWarmUp(lang);
  const [phase, setPhase] = useState<Phase>({ kind: "live" });
  const [camera, setCamera] = useState<"starting" | "live" | "unavailable">("starting");
  const [selected, setSelected] = useState<TieredBox | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const newest = useRef(0); // only the latest read may update the screen
  const currentUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    },
    [],
  );

  const read = useCallback(async (photo: Photo, forLang: Lang, startedAt: number) => {
    const id = ++newest.current;
    setSelected(null);
    setPhase({ kind: "reading", photo });
    let size: Size | undefined;
    try {
      const { bitmap, width, height } = await toOcrBitmap(photo.blob);
      size = { width, height };
      if (id === newest.current) setPhase({ kind: "reading", photo, size });
      const result = await recognize(forLang, bitmap);
      const lines = result.items.map((item) => ({ text: item.text, poly: item.poly }));
      const boxes = tierBoxes(lines, getLang(forLang));
      if (id === newest.current) {
        setPhase({ kind: "result", photo, size, boxes, ms: Math.round(performance.now() - startedAt) });
      }
    } catch (error) {
      console.error("Reading the photo failed:", error instanceof Error ? error.message : "unknown error");
      if (id === newest.current) setPhase({ kind: "error", photo, size });
    }
  }, []);

  const takePhoto = useCallback(
    async (getBlob: () => Promise<Blob>) => {
      const startedAt = performance.now();
      try {
        const blob = await getBlob();
        const photo = { blob, url: URL.createObjectURL(blob) };
        currentUrl.current = photo.url;
        await read(photo, lang, startedAt);
      } catch (error) {
        console.error("Taking the photo failed:", error instanceof Error ? error.message : "unknown error");
      }
    },
    [lang, read],
  );

  const retake = () => {
    newest.current++; // drop any read still running
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
    setSelected(null);
    setCamera((c) => (c === "unavailable" ? c : "starting"));
    setPhase({ kind: "live" });
  };

  const changeLang = (next: Lang) => {
    setLang(next);
    // A photo already taken is read again in the new language
    if (phase.kind === "result" || phase.kind === "error") void read(phase.photo, next, performance.now());
  };

  const onReady = useCallback(() => setCamera("live"), []);
  const onUnavailable = useCallback(() => setCamera("unavailable"), []);

  return (
    <main className="camera">
      <h1 className="sr-only">Lingua Camera</h1>
      <header className="topbar">
        <LangChip lang={lang} disabled={phase.kind === "reading"} onChange={changeLang} />
      </header>
      <ModelStatus progress={progress} />

      <div className="screen">
        {phase.kind === "live" ? (
          camera === "unavailable" ? (
            <p className="hint">The live camera isn't available here. Use the buttons below to add a photo.</p>
          ) : (
            <Viewfinder videoRef={videoRef} onReady={onReady} onUnavailable={onUnavailable} />
          )
        ) : (
          phase.size && (
            <PhotoView
              key={phase.photo.url}
              url={phase.photo.url}
              size={phase.size}
              boxes={phase.kind === "result" ? phase.boxes : []}
              reading={phase.kind !== "result"}
              selected={selected}
              onSelect={setSelected}
            />
          )
        )}
        {phase.kind === "reading" && (
          <p className="reading" role="status">
            <span className="spinner" aria-hidden="true" /> Reading text…
          </p>
        )}
        {phase.kind === "error" && (
          <p className="reading" role="alert">
            Couldn't read this photo. Try again.
          </p>
        )}
      </div>

      <footer className={`controls${phase.kind === "live" && camera !== "unavailable" ? " controls-shutter" : ""}`}>
        {phase.kind === "live" ? (
          <>
            <PhotoPickers showTakePhoto={camera === "unavailable"} onPhoto={(file) => void takePhoto(async () => file)} />
            {camera !== "unavailable" && (
              <button
                type="button"
                className="shutter"
                aria-label="Take photo"
                disabled={camera !== "live"}
                onClick={() => {
                  const video = videoRef.current;
                  if (video) void takePhoto(() => captureFrame(video));
                }}
              />
            )}
          </>
        ) : (
          <>
            <button type="button" className="button button-primary" onClick={retake}>
              Retake
            </button>
            {phase.kind === "result" && (
              <p className="selected" role="status">
                {selected ? selected.text : "Tap a word"} · read in {(phase.ms / 1000).toFixed(1)} s
              </p>
            )}
          </>
        )}
      </footer>
    </main>
  );
}
