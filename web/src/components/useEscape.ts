import { useEffect } from "react";

/** Calls `onEscape` wherever focus is: on the document, as tapping the map moves focus away. */
export function useEscape(onEscape: () => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape]);
}
