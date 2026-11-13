// Downloads the OCR files for a language (through the service worker, which caches them), then loads the models
// One job per language; components subscribe to its progress
import type { Lang } from "@lingua-camera/shared";
import { loadOcr } from "./engine.ts";

export interface WarmUpProgress {
  phase: "downloading" | "loading" | "ready" | "error";
  loaded: number; // bytes
  total: number; // bytes, 0 when unknown
}

const COMMON = ["/ort/ort-wasm-simd-threaded.mjs", "/ort/ort-wasm-simd-threaded.wasm", "/models/PP-OCRv5_mobile_det.tar"];
const REC: Record<Lang, string> = {
  fr: "/models/latin_PP-OCRv5_mobile_rec.tar",
  zh: "/models/PP-OCRv5_mobile_rec.tar",
};

export const assetsFor = (lang: Lang): string[] => [...COMMON, REC[lang]];

// File sizes written at build time by scripts/ocr-assets.mjs
async function readSizes(): Promise<Record<string, number>> {
  try {
    const res = await fetch("/ocr-assets.json");
    return res.ok ? ((await res.json()) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

async function isCached(url: string): Promise<boolean> {
  try {
    return (await caches.match(url)) !== undefined;
  } catch {
    return false; // Cache API unavailable
  }
}

// The service worker must control the page, or the downloads would not be cached
async function serviceWorkerReady(): Promise<void> {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 3000))]);
}

async function download(url: string, onBytes: (n: number) => void): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    onBytes(value.length);
  }
}

interface Job {
  last: WarmUpProgress;
  listeners: Set<(p: WarmUpProgress) => void>;
}
const jobs = new Map<Lang, Job>();

function start(lang: Lang, job: Job): void {
  const publish = (p: WarmUpProgress) => {
    job.last = p;
    job.listeners.forEach((fn) => fn(p));
  };
  void (async () => {
    const sizes = await readSizes();
    const urls = assetsFor(lang);
    const total = urls.reduce((sum, u) => sum + (sizes[u] ?? 0), 0);
    let loaded = 0;
    await serviceWorkerReady();
    publish({ phase: "downloading", loaded, total });
    for (const url of urls) {
      if (await isCached(url)) {
        loaded += sizes[url] ?? 0;
        publish({ phase: "downloading", loaded, total });
        continue;
      }
      await download(url, (n) => {
        loaded += n;
        publish({ phase: "downloading", loaded, total });
      });
    }
    publish({ phase: "loading", loaded, total });
    await loadOcr(lang);
    publish({ phase: "ready", loaded, total });
  })().catch((error: unknown) => {
    console.error("OCR warm-up failed", error instanceof Error ? error.message : "unknown error");
    jobs.delete(lang); // the next subscriber retries
    publish({ phase: "error", loaded: 0, total: 0 });
  });
}

// Starts the job if needed and reports its progress; returns an unsubscribe function
export function subscribeWarmUp(lang: Lang, listener: (p: WarmUpProgress) => void): () => void {
  let job = jobs.get(lang);
  if (!job) {
    job = { last: { phase: "downloading", loaded: 0, total: 0 }, listeners: new Set() };
    jobs.set(lang, job);
    job.listeners.add(listener);
    start(lang, job);
  } else {
    job.listeners.add(listener);
    listener(job.last);
  }
  const mine = job;
  return () => {
    mine.listeners.delete(listener);
  };
}
