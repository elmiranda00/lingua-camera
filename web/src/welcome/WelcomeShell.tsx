// Navy page with the logo: the frame for every /join state
import type { ReactNode } from "react";
import "./welcome.css";
import { BrandMark } from "./BrandMark.tsx";

export function WelcomeShell({ children }: { children: ReactNode }) {
  return (
    <main className="welcome">
      <div className="welcome-glow welcome-glow-top" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-bottom" aria-hidden="true" />
      <BrandMark />
      {children}
    </main>
  );
}
