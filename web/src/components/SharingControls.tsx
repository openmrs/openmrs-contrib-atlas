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
  // The editor change in flight, shown in the list before the service answers.
  const [pending, setPending] = useState<{ kind: "add" | "remove"; name: string }>();

  async function run(task: () => Promise<void>, onFailure?: () => void) {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (err) {
      onFailure?.();
      setError(
        err instanceof ApiError
          ? (err.errors[0]?.reason ?? err.message)
          : "That didn't work. Please try again.",
      );
    } finally {
      setPending(undefined);
      setBusy(false);
    }
  }

  const addEditor = () => {
    const typed = editor;
    // Shown the way the service stores it.
    const name = typed.trim().toLowerCase();
    setPending({ kind: "add", name });
    setEditor("");
    return run(
      async () => {
        const result = await api<MarkerResult>(`${markerPath(markerId)}/editors`, "POST", {
          username: typed,
        });
        onEditors(result.editors ?? editors);
        onResult(result);
      },
      // Back in the box, to correct.
      () => setEditor(typed),
    );
  };

  const removeEditor = (name: string) => {
    setPending({ kind: "remove", name });
    return run(async () => {
      const result = await api<MarkerResult>(
        `${markerPath(markerId)}/editors/${encodeURIComponent(name)}`,
        "DELETE",
      );
      onEditors(result.editors ?? editors);
      onResult(result);
    });
  };

  const adding = pending?.kind === "add" && !editors.includes(pending.name) ? pending.name : "";
  const shown = editors.filter((name) => !(pending?.kind === "remove" && pending.name === name));

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
      {(shown.length > 0 || adding) && (
        <ul className="editor-list">
          {shown.map((name) => (
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
          {adding && (
            <li className="pending">
              {adding}
              <span>Adding…</span>
            </li>
          )}
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
        {pending?.kind === "add" ? "Adding…" : "Add editor"}
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
