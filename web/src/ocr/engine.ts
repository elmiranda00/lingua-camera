// Page-side OCR client: talks to the OCR worker
import type { OcrResult } from "@paddleocr/paddleocr-js";
import type { Lang } from "@lingua-camera/shared";
import type { OcrRequest, OcrResponse } from "./protocol.ts";

type Outgoing = OcrRequest extends infer R ? (R extends OcrRequest ? Omit<R, "id"> : never) : never;
let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, (r: OcrResponse) => void>();

// Threads need cross-origin isolation (set by the Worker's headers); otherwise one
export function defaultThreads(): number {
  if (!globalThis.crossOriginIsolated) return 1;
  return Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./ocr.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<OcrResponse>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

function send(req: Outgoing, transfer: Transferable[] = []): Promise<OcrResponse> {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    w.postMessage({ ...req, id }, transfer);
  });
}

function unwrap(res: OcrResponse): OcrResponse & { ok: true } {
  if (!res.ok) throw new Error(res.message);
  return res;
}

// Prepares the models for a language (safe to call more than once)
export async function loadOcr(lang: Lang, threads = defaultThreads()): Promise<void> {
  unwrap(await send({ type: "load", lang, threads }));
}

// The image is transferred to the worker and can't be used afterwards
export async function recognize(lang: Lang, image: ImageBitmap, threads = defaultThreads()): Promise<OcrResult> {
  const { result } = unwrap(await send({ type: "read", lang, threads, image }, [image]));
  if (!result) throw new Error("OCR returned no result");
  return result;
}
