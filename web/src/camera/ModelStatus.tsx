// Banner while the OCR models download or load (first run only)
import type { WarmUpProgress } from "../ocr/warmup.ts";

const MB = 1024 * 1024;

export function ModelStatus({ progress }: { progress: WarmUpProgress }) {
  if (progress.phase === "ready") return null;
  if (progress.phase === "error") {
    return (
      <p className="status status-error" role="alert">
        Couldn't get the text reader ready. Check your connection and reload.
      </p>
    );
  }
  if (progress.phase === "loading") return <p className="status" role="status">Starting the text reader…</p>;
  const { loaded, total } = progress;
  return (
    <div className="status" role="status">
      <span>
        Getting the text reader ready{total > 0 ? `: ${Math.round(loaded / MB)} of ${Math.round(total / MB)} MB` : "…"}
      </span>
      {total > 0 && <progress value={loaded} max={total} aria-label="Download progress" />}
      <span className="status-note">Only the first time</span>
    </div>
  );
}
