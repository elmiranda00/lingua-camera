// Signed-in welcome: rotating greeting with the user's name, and the way into the camera
// Only render after /api/me has accepted the token: it says "You are signed in"
import { useNavigate } from "react-router";
import { START_CAMERA } from "../camera/autoStart.ts";
import { RotatingGreeting } from "./RotatingGreeting.tsx";
import { WelcomeShell } from "./WelcomeShell.tsx";

function CameraIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none">
      <path
        d="M8.4 6.2 9.6 4h4.8l1.2 2.2H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.2a2 2 0 0 1 2-2h3.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function WelcomeScreen({ name }: { name: string }) {
  const navigate = useNavigate();
  const shown = name.trim();

  return (
    <WelcomeShell>
      <section className="welcome-content" aria-labelledby="welcome-heading">
        <div className="welcome-frame" aria-hidden="true">
          <span className="welcome-corner welcome-corner-tl" />
          <span className="welcome-corner welcome-corner-tr" />
          <span className="welcome-corner welcome-corner-bl" />
          <span className="welcome-corner welcome-corner-br" />
        </div>

        <h1 id="welcome-heading" className="welcome-heading">
          {/* Screen readers get one stable name instead of every greeting change */}
          <span className="welcome-sr-only">{shown ? `Welcome, ${shown}` : "Welcome"}</span>
          <span aria-hidden="true">
            <span className="welcome-greeting-line">
              <RotatingGreeting />
              {shown && ","}
            </span>
            {shown && (
              <>
                {" "}
                <span className="welcome-name">{shown}</span>
              </>
            )}
          </span>
        </h1>
        <p className="welcome-intro">Point your camera at any text and understand it instantly.</p>
      </section>

      <section className="welcome-actions" aria-label="Get started">
        <p className="welcome-status">
          <span className="welcome-status-dot" aria-hidden="true" />
          You are signed in
        </p>
        <button
          type="button"
          className="welcome-camera-button"
          onClick={() => void navigate("/", { state: START_CAMERA })}
        >
          <span>Open the Camera</span>
          <CameraIcon />
        </button>
        <p className="welcome-note">Camera access is only used for translation</p>
      </section>
    </WelcomeShell>
  );
}
