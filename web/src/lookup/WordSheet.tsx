// Bottom sheet with the meaning of the tapped word
//
// Not modal: the photo stays tappable, and tapping another word replaces the content
import { useEffect } from "react";
import "./sheet.css";
import { FAILURE_MESSAGE, type SheetState, type WordInfo } from "./lookupController.ts";

interface Props {
  state: SheetState;
  onRetry: () => void;
  onClose: () => void;
}

const GENDER = { m: "masculine", f: "feminine" } as const;

function Details({ info }: { info: WordInfo }) {
  const { result } = info;
  const pos = result.gender ? `${result.pos} · ${GENDER[result.gender]}` : result.pos;
  const differs = result.headword.toLowerCase() !== info.word.toLowerCase();
  return (
    <>
      {info.pinyin && <p className="sheet-pinyin">{info.pinyin}</p>}
      <p className="sheet-meaning">{result.meaningInContext}</p>
      <p className="sheet-meta">
        {pos}
        {differs && <> · dictionary form: <span lang={info.lang}>{result.headword}</span></>}
      </p>
      {result.otherMeanings.length > 0 && <p className="sheet-more">Also: {result.otherMeanings.join("; ")}</p>}
      {result.note && <p className="sheet-more">Expression: {result.note}</p>}
    </>
  );
}

export function WordSheet({ state, onRetry, onClose }: Props) {
  const open = state.status !== "idle";
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (state.status === "idle") return null;
  const word = state.status === "ready" ? state.info.word : state.word;
  const lang = state.status === "ready" ? state.info.lang : undefined;

  return (
    <section className="sheet" aria-label="Translation" aria-live="polite">
      <button type="button" className="sheet-close" aria-label="Close translation" onClick={onClose}>
        ×
      </button>
      <p className="sheet-word" lang={lang}>
        {word}
      </p>
      {state.status === "loading" && (
        <p className="sheet-status">
          <span className="spinner" aria-hidden="true" /> Translating…
        </p>
      )}
      {state.status === "error" && (
        <>
          <p className="sheet-status" role="alert">
            {FAILURE_MESSAGE[state.failure]}
          </p>
          {state.failure === "other" && (
            <button type="button" className="button" onClick={onRetry}>
              Try again
            </button>
          )}
        </>
      )}
      {state.status === "ready" && <Details info={state.info} />}
    </section>
  );
}
