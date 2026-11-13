// Small hooks for the camera page
import type { Lang } from "@lingua-camera/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeWarmUp, type WarmUpProgress } from "../ocr/warmup.ts";
import { readStoredLang, storeLang } from "./settings.ts";

// The chosen language, remembered on this phone
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>(readStoredLang);
  const choose = useCallback((next: Lang) => {
    storeLang(next);
    setLang(next);
  }, []);
  return [lang, choose];
}

// Size of an element, kept up to date
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

// Progress of getting the OCR models ready for a language
export function useWarmUp(lang: Lang): WarmUpProgress {
  const [state, setState] = useState<{ lang: Lang; progress: WarmUpProgress }>({
    lang,
    progress: { phase: "downloading", loaded: 0, total: 0 },
  });
  useEffect(() => subscribeWarmUp(lang, (progress) => setState({ lang, progress })), [lang]);
  // A different language starts from "downloading" until its own job reports
  return state.lang === lang ? state.progress : { phase: "downloading", loaded: 0, total: 0 };
}
