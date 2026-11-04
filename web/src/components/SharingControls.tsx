import { useState } from "react";
import { ApiError, api, markerPath, type MarkerResult } from "../lib/api.ts";
import { AccountPicker } from "./AccountPicker.tsx";

interface Props {
  markerId: string;
  editors: string[];
  offerTo?: string;
  hasOwner: boolean;
  onResult: (result: MarkerResult) => void;
  onEditors: (editors: string[]) => void;
  onOffer: (to: string | undefined) => void;
}

/** Editors and transfers take effect at once, separately from the form's Save. */
export function SharingControls({
  markerId,
  editors,
  offerTo,
  hasOwner,
  onResult,
  onEditors,
  onOffer,
}: Props) {
  const [editor, setEditor] = useState("");
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.errors[0]?.reason ?? err.message)
          : "That didn't work. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const addEditor = () =>
    run(async () => {
      const result = await api<MarkerResult>(`${markerPath(markerId)}/editors`, "POST", {
        username: editor,
      });
      onEditors(result.editors ?? editors);
      onResult(result);
      setEditor("");
    });

  const removeEditor = (name: string) =>
    run(async () => {
      const result = await api<MarkerResult>(
        `${markerPath(markerId)}/editors/${encodeURIComponent(name)}`,
        "DELETE",
      );
      onEditors(result.editors ?? editors);
      onResult(result);
    });

  const offer = () =>
    run(async () => {
      const result = await api<MarkerResult>(`${markerPath(markerId)}/transfer`, "POST", {
        username: recipient,
      });
      onOffer(result.offer_to);
      onResult(result);
      setRecipient("");
    });

  const cancel = () =>
    run(async () => {
      await api(`${markerPath(markerId)}/transfer`, "DELETE");
      onOffer(undefined);
    });

  return (
    <section className="sharing" aria-label="Sharing">
      <h3>Editors</h3>
      <p className="hint">
        Editors can change and confirm this marker. These changes apply straight away.
      </p>
      {editors.length > 0 && (
        <ul className="editor-list">
          {editors.map((name) => (
            <li key={name}>
              {name}
              <button
                type="button"
                className="link"
                aria-label={`Remove ${name}`}
                disabled={busy}
                onClick={() => void removeEditor(name)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <AccountPicker
        label="Add an editor by OpenMRS ID"
        value={editor}
        onChange={setEditor}
        onSubmit={() => {
          if (editor.trim() && !busy) void addEditor();
        }}
        disabled={busy}
      />
      <button
        type="button"
        className="secondary"
        disabled={busy || !editor.trim()}
        onClick={() => void addEditor()}
      >
        Add editor
      </button>

      {hasOwner && (
        <>
          <h3>Transfer ownership</h3>
          {offerTo ? (
            <>
              <p>
                Waiting for {offerTo} to accept. Please let them know: they will find the offer in
                My markers.
              </p>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => void cancel()}
              >
                Cancel offer
              </button>
            </>
          ) : (
            <>
              <AccountPicker
                label="New owner's OpenMRS ID"
                value={recipient}
                onChange={setRecipient}
                onSubmit={() => {
                  if (recipient.trim() && !busy) void offer();
                }}
                disabled={busy}
              />
              <p className="hint">
                They must accept within 30 days. You stay on as an editor afterwards.
              </p>
              <button
                type="button"
                className="secondary"
                disabled={busy || !recipient.trim()}
                onClick={() => void offer()}
              >
                Offer ownership
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
