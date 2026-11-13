// OCR Web Worker: runs PaddleOCR off the main thread; every file comes from our own origin
import { PaddleOCR } from "@paddleocr/paddleocr-js";
import cv from "@techstark/opencv-js";
import type { Lang } from "@lingua-camera/shared";
import type { OcrRequest, OcrResponse } from "./protocol.ts";

const MODELS: Record<Lang, { det: string; rec: string }> = {
  fr: { det: "PP-OCRv5_mobile_det", rec: "latin_PP-OCRv5_mobile_rec" },
  zh: { det: "PP-OCRv5_mobile_det", rec: "PP-OCRv5_mobile_rec" },
};

type Engine = Awaited<ReturnType<typeof PaddleOCR.create>>;
const engines = new Map<string, Promise<Engine>>();

const asset = (name: string) => ({ url: new URL(`/models/${name}.tar`, self.location.origin).href });

function engine(lang: Lang, threads: number): Promise<Engine> {
  const key = `${lang}:${threads}`;
  let e = engines.get(key);
  if (!e) {
    const { det, rec } = MODELS[lang];
    e = PaddleOCR.create({
      worker: false, // already inside a worker
      textDetectionModelName: det,
      textRecognitionModelName: rec,
      textDetectionModelAsset: asset(det),
      textRecognitionModelAsset: asset(rec),
      // wasmPaths must be set: the library's default is a CDN
      ortOptions: { backend: "wasm", wasmPaths: "/ort/", numThreads: threads },
    });
    e.catch(() => engines.delete(key));
    engines.set(key, e);
  }
  return e;
}

// The library's own image loader needs `document`; a Mat built here avoids it
function toMat(image: ImageBitmap): cv.Mat {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No 2D canvas in worker");
  ctx.drawImage(image, 0, 0);
  image.close();
  return cv.matFromImageData(ctx.getImageData(0, 0, canvas.width, canvas.height) as unknown as ImageData);
}

async function handle(req: OcrRequest): Promise<OcrResponse> {
  const ocr = await engine(req.lang, req.threads);
  if (req.type === "load") return { id: req.id, ok: true };
  const mat = toMat(req.image);
  try {
    const [result] = await ocr.predict(mat);
    if (!result) throw new Error("OCR returned no result");
    return { id: req.id, ok: true, result };
  } finally {
    mat.delete();
  }
}

self.onmessage = async (event: MessageEvent<OcrRequest>) => {
  const req = event.data;
  let res: OcrResponse;
  try {
    res = await handle(req);
  } catch (e) {
    res = { id: req.id, ok: false, message: e instanceof Error ? e.message : String(e) };
  }
  self.postMessage(res);
};
