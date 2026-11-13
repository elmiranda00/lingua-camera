// Temporary OCR check page (removed when the camera page lands)
import type { OcrResult } from "@paddleocr/paddleocr-js";
import { useState } from "react";
import type { Lang } from "@lingua-camera/shared";
import { loadOcr, recognize } from "../ocr/engine.ts";

export function OcrTest() {
  const [lang, setLang] = useState<Lang>("fr");
  const [status, setStatus] = useState("Pick a photo");
  const [url, setUrl] = useState<string>();
  const [result, setResult] = useState<OcrResult>();

  async function onFile(file: File) {
    setResult(undefined);
    setUrl(URL.createObjectURL(file));
    try {
      setStatus("Loading models…");
      const t0 = performance.now();
      await loadOcr(lang);
      const loadMs = Math.round(performance.now() - t0);
      setStatus("Reading…");
      const t1 = performance.now();
      const res = await recognize(lang, await createImageBitmap(file));
      const ocrMs = Math.round(performance.now() - t1);
      setResult(res);
      setStatus(`model load ${loadMs} ms · OCR ${ocrMs} ms · det ${Math.round(res.metrics.detMs)} · rec ${Math.round(res.metrics.recMs)} · ${res.items.length} lines · ${res.runtime.detProvider}`);
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <main>
      <h1>OCR test</h1>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
        <option value="fr">French</option>
        <option value="zh">Chinese</option>
      </select>{" "}
      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
      <p>{status}</p>
      {url && result && (
        <div style={{ position: "relative", maxWidth: "100%" }}>
          <img src={url} alt="Uploaded" style={{ width: "100%", display: "block" }} />
          <svg
            viewBox={`0 0 ${result.image.width} ${result.image.height}`}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            {result.items.map((it, i) => (
              <polygon key={i} points={it.poly.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="red" strokeWidth={3} />
            ))}
          </svg>
        </div>
      )}
      {result && <pre>{result.items.map((it) => `${it.score.toFixed(2)}  ${it.text}`).join("\n")}</pre>}
    </main>
  );
}
