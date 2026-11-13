// Language chip: tap to switch between French and Chinese
import type { Lang } from "@lingua-camera/shared";

const LABEL: Record<Lang, { short: string; long: string }> = {
  fr: { short: "FR", long: "French" },
  zh: { short: "中文", long: "Chinese" },
};

interface Props {
  lang: Lang;
  disabled: boolean;
  onChange: (lang: Lang) => void;
}

export function LangChip({ lang, disabled, onChange }: Props) {
  const next: Lang = lang === "fr" ? "zh" : "fr";
  return (
    <button
      type="button"
      className="chip"
      disabled={disabled}
      onClick={() => onChange(next)}
      aria-label={`Language: ${LABEL[lang].long}. Switch to ${LABEL[next].long}`}
    >
      {LABEL[lang].short}
    </button>
  );
}
