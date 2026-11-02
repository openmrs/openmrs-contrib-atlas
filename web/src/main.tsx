import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { completeAuthReturn, isAuthReturn } from "./auth/session.ts";
import { initAnalytics } from "./lib/analytics.ts";
import "./styles.css";

initAnalytics();

function render(signInError?: string) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App signInError={signInError} />
    </StrictMode>,
  );
}

// Before App reads the address bar, so it sees the view that was saved before signing in.
if (isAuthReturn(window.location.search)) void completeAuthReturn().then(render);
else render();
