// App glyph (viewfinder corners + swap arrows), for dark backgrounds
// Master copy: docs/brand/glyph-dark-bg.svg
interface Props {
  size: number;
  className?: string;
}

export function Glyph({ size, className }: Props) {
  return (
    <svg
      viewBox="16 16 68 68"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 38V22H38M62 22H78V38M78 62V78H62M38 78H22V62" stroke="#fff" strokeWidth="6" />
      <path d="M37 43H63M56 36L63 43L56 50M63 57H37M44 50L37 57L44 64" stroke="#20d8b5" strokeWidth="5.5" />
    </svg>
  );
}
