// Web app entry
import "@lingua-camera/shared/browser-setup"; // must stay first: see that file
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

// Keeps the OCR files and the app on the phone (production only: dev files change constantly)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
    console.error("Service worker registration failed:", error instanceof Error ? error.message : "unknown error");
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
