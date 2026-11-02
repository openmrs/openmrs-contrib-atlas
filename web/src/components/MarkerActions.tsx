import { useState } from "react";
import { ApiError, api, markerPath, type MarkerResult } from "../lib/api.ts";

interface Props {
  markerId: string;
  canDelete: boolean;
  onEdit: () => void;
  onResult: (result: MarkerResult) => void;
}

/** Edit, "Still current" and delete, for those allowed. The service checks again. */
export function MarkerActions({ markerId, canDelete, onEdit, onResult }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function act(path: string, method: string) {
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
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void act(`${markerPath(markerId)}/confirm`, "POST")}
        >
          Still current
        </button>
        {canDelete && !confirmingDelete && (
          <button type="button" className="secondary" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
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
