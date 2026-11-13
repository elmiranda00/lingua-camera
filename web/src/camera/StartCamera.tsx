// The black camera box before the camera is on: tap the camera icon to start it
interface Props {
  onStart: () => void;
}

export function StartCamera({ onStart }: Props) {
  return (
    <button type="button" className="camera-start" onClick={onStart} aria-label="Start camera">
      <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true" focusable="false">
        <path
          d="M8 20a4 4 0 0 1 4-4h8l3-5h18l3 5h8a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"
          fill="none"
          stroke="#fff"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="34" r="10" fill="none" stroke="#fff" strokeWidth="3" />
        <circle cx="32" cy="34" r="3" fill="#e5251b" />
      </svg>
      <span className="camera-start-bar" aria-hidden="true" />
      <span className="camera-start-label">Tap to start the camera</span>
    </button>
  );
}
