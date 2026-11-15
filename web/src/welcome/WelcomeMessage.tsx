// A /join outcome other than signed in (bad link, offline...), in the welcome shell
import type { ReactNode } from "react";
import { WelcomeShell } from "./WelcomeShell.tsx";

interface Props {
  title: string;
  role: "alert" | "status";
  children: ReactNode;
}

export function WelcomeMessage({ title, role, children }: Props) {
  return (
    <WelcomeShell>
      <section className="welcome-content welcome-message">
        <h1 className="welcome-message-title">{title}</h1>
        <p className="welcome-intro" role={role}>
          {children}
        </p>
      </section>
    </WelcomeShell>
  );
}
