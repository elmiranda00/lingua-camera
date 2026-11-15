// "Welcome" / "Bienvenue" / "你好", one every 2 s; each change replays the CSS entry animation
import { useEffect, useState } from "react";

export const GREETINGS = ["Welcome", "Bienvenue", "你好"] as const;
const INTERVAL_MS = 2000;

export function RotatingGreeting() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % GREETINGS.length), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // The key remounts the span, so the animation runs again
  return (
    <span key={index} className="welcome-greeting" lang={index === 1 ? "fr" : index === 2 ? "zh-Hans" : undefined}>
      {GREETINGS[index]}
    </span>
  );
}
