import { useState } from "react";
import { ApiError, api, markerPath, needsSignInAgain, type MarkerResult } from "../lib/api.ts";
import { AccountPicker } from "./AccountPicker.tsx";

interface Props {
  markerId: string;
  editors: string[];
  offerTo?: string;
  hasOwner: boolean;
  onResult: (result: MarkerResult) => void;
  onEditors: (editors: string[]) => void;
  onOffer: (to: string | undefined) => void;
  /** Offering a transfer needs a recent sign-in (specs/user-sign-in). */
  onSignInAgain: () => void;
}

/** The new owner's ID, kept across the fresh sign-in a transfer may need. */
const TRANSFER_DRAFT = "atlas.transfer-draft";

function takeRecipient(markerId: string): string {
  try {
    const stored = sessionStorage.getItem(TRANSFER_DRAFT);
    sessionStorage.removeItem(TRANSFER_DRAFT);
    const draft = stored ? (JSON.parse(stored) as { markerId?: string; to?: string }) : undefined;
    return draft?.markerId === markerId && typeof draft.to === "string" ? draft.to : "";
  } catch {
    return "";
  }
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
  onSignInAgain,
}: Props) {
  const [editor, setEditor] = useState("");
  const [recipient, setRecipient] = useState(() => takeRecipient(markerId));
  // Which box needs a fresh sign-in: an admin sharing someone else's marker, or a transfer.
  const [freshNeeded, setFreshNeeded] = useState<"editors" | "transfer">();
  // Shown under the box it concerns, so it's in view next to what was typed.
  const [error, setError] = useState<{ where: "editors" | "transfer"; text: string }>();
  const [busy, setBusy] = useState(false);
  // The editor change in flight, shown in the list before the service answers.
  const [pending, setPending] = useState<{ kind: "add" | "remove"; name: string }>();

  async function run(
    where: "editors" | "transfer",
    task: () => Promise<void>,
    onFailure?: () => void,
  ) {
    setBusy(true);
    setError(undefined);
    setFreshNeeded(undefined);
    try {
      await task();
    } catch (err) {
      onFailure?.();
      if (needsSignInAgain(err)) {
        setFreshNeeded(where);
        return;
      }
      setError({
        where,
        text:
          err instanceof ApiError
            ? (err.errors[0]?.reason ?? err.message)
            : "That didn't work. Please try again.",
      });
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
      "editors",
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
    return run("editors", async () => {
      const result = await api<MarkerResult>(
        `${markerPath(markerId)}/editors/${encodeURIComponent(name)}`,
        "DELETE",
      );
      onEditors(result.editors ?? editors);
      onResult(result);
    });
  };

  const errorFor = (where: "editors" | "transfer") =>
    (error?.where === where && (
      <p className="error" role="alert">
        {error.text}
      </p>
    )) ||
    (freshNeeded === where && (
      <div role="alert" className="confirm">
        <p>
          {where === "transfer"
            ? "For your safety, please sign in again to transfer this marker. The new owner's ID will be kept."
            : "For your safety, please sign in again to change this marker's editors."}
        </p>
        <button type="button" className="primary" onClick={signInAgain}>
          Sign in again
        </button>
      </div>
    ));

  const adding = pending?.kind === "add" && !editors.includes(pending.name) ? pending.name : "";
  const shown = editors.filter((name) => !(pending?.kind === "remove" && pending.name === name));

  const offer = () =>
    run("transfer", async () => {
      const result = await api<MarkerResult>(`${markerPath(markerId)}/transfer`, "POST", {
        username: recipient,
      });
      onOffer(result.offer_to);
      onResult(result);
      setRecipient("");
    });

  const signInAgain = () => {
    try {
      sessionStorage.setItem(TRANSFER_DRAFT, JSON.stringify({ markerId, to: recipient }));
    } catch {
      // Without storage the ID is typed again.
    }
    onSignInAgain();
  };

  const cancel = () =>
    run("transfer", async () => {
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
      {errorFor("editors")}
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
              {errorFor("transfer")}
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
              {errorFor("transfer")}
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
    </section>
  );
}
