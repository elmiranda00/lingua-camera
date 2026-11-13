// Messages between the page and the OCR worker
import type { OcrResult } from "@paddleocr/paddleocr-js";
import type { Lang } from "@lingua-camera/shared";

export type OcrRequest =
  | { id: number; type: "load"; lang: Lang; threads: number }
  | { id: number; type: "read"; lang: Lang; threads: number; image: ImageBitmap };

export type OcrResponse =
  | { id: number; ok: true; result?: OcrResult }
  | { id: number; ok: false; message: string };
