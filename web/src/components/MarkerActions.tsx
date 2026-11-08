import { useEffect, useRef, useState } from "react";
import { needsConfirming } from "@openmrs-atlas/shared/freshness";
import { ApiError, api, markerPath, type MarkerResult } from "../lib/api.ts";

interface Props {
  markerId: string;
  /** May close, reopen and delete: the owner or an admin. */
  canManage: boolean;
  closed: boolean;
  /** When it was last confirmed: "Still current" is offered only once that is 12 months ago. */
  confirmedAt: string | undefined;
  onEdit: () => void;
  onResult: (result: MarkerResult) => void;
}

/**
 * Edit, and "Still current" once a marker is 12 months past its last confirmation (until then,
 * signing in keeps it current), with rarer actions in a menu. The service checks again.
 */
export function MarkerActions({
  markerId,
  canManage,
  closed,
  confirmedAt,
  onEdit,
  onResult,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector("button")?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    trigger.current?.focus();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = [...(menu.current?.querySelectorAll("button") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      // Escape here closes the menu, not the marker panel behind it.
      e.stopPropagation();
      closeMenu();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    }
  }

  async function act(path: string, method: string) {
    setMenuOpen(false);
    setBusy(true);
    setError(undefined);
    try {
      onResult(await api<MarkerResult>(path, method));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="marker-actions">
      <div className="button-row">
        <button type="button" className="primary" onClick={onEdit}>
          Edit
        </button>
        {!closed && needsConfirming(confirmedAt, new Date()) && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void act(`${markerPath(markerId)}/confirm`, "POST")}
          >
            Still current
          </button>
        )}
        {canManage && (
          <div className="menu-anchor">
            <button
              ref={trigger}
              type="button"
              className="secondary"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={busy}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div ref={menu} role="menu" className="menu" onKeyDown={onMenuKeyDown}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    void act(`${markerPath(markerId)}/${closed ? "reopen" : "close"}`, "POST")
                  }
                >
                  {closed ? "Reopen site" : "Close site"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmingDelete(true);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {confirmingDelete && (
        <div role="alertdialog" aria-label="Delete this marker?" className="confirm">
          <p>Delete this marker? It will leave the public map.</p>
          <div className="button-row">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void act(markerPath(markerId), "DELETE")}
            >
              Yes, delete
            </button>
            <button type="button" className="secondary" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
