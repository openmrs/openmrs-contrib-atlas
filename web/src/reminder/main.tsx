import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./reminder.css";
import { ReminderPage } from "./ReminderPage.tsx";

// No analytics here: the address holds a personal link.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReminderPage token={window.location.hash.slice(1)} />
  </StrictMode>,
);
