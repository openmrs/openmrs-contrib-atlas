import { useEffect, useRef, useState } from "react";
import { track } from "../lib/analytics.ts";
import {
  ApiError,
  approveClaim,
  claimMarker,
  declineClaim,
  withdrawClaim,
  type ClaimToReview,
  type MarkerResult,
  type MyClaim,
} from "../lib/api.ts";

export const MAX_MESSAGE = 1000;
export const MAX_REASON = 500;

const dayMonthYear = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const claimDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dayMonthYear.format(date);
};

const failed = (err: unknown) =>
  err instanceof ApiError ? err.message : "That didn't work. Please try again.";

interface Props {
  markerId: string;
  /** This person may claim the marker: it has no owner and they have no claim waiting. */
  claimable: boolean;
  /** Their own claim on it, waiting for an admin. */
  mine?: MyClaim;
  /** Admins: the claims waiting on this marker. */
  review: ClaimToReview[];
  /** Reload what the service says about this person. */
  onChanged: () => void;
  /** An approval changed the marker. */
  onApproved: (result: MarkerResult) => void;
}

/** Claiming a marker with no owner, and the admin's review of claims (specs/marker-claims). */
export function ClaimPanel({ markerId, claimable, mine, review, onChanged, onApproved }: Props) {
  if (review.length > 0) {
    return (
      <ClaimReview
        markerId={markerId}
        review={review}
        onChanged={onChanged}
        onApproved={onApproved}
      />
    );
  }
  if (mine) return <WaitingClaim markerId={markerId} claim={mine} onChanged={onChanged} />;
  if (claimable) return <ClaimForm markerId={markerId} onChanged={onChanged} />;
  return null;
}

function ClaimForm({ markerId, onChanged }: { markerId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <section className="claim" aria-label="Claim this site">
        <p className="hint">
          This site has no owner on the Atlas. If you run it, you can claim it.
        </p>
        <button type="button" className="secondary" onClick={() => setOpen(true)}>
          Claim this site
        </button>
      </section>
    );
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please say how you are connected to this site.");
      field.current?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await claimMarker(markerId, message.trim());
      track("claim", { marker_id: markerId });
      onChanged();
    } catch (err) {
      setError(failed(err));
      setBusy(false);
    }
  }

  return (
    <form className="claim" aria-label="Claim this site" onSubmit={(e) => void send(e)} noValidate>
      <label htmlFor="claim-message">How are you connected to this site?</label>
      <textarea
        id="claim-message"
        ref={field}
        rows={4}
        maxLength={MAX_MESSAGE}
        value={message}
        aria-describedby="claim-message-hint"
        aria-invalid={error ? true : undefined}
        onChange={(e) => setMessage(e.target.value)}
      />
      <p className="hint" id="claim-message-hint">
        An admin reads this before making you the owner. {message.length} of{" "}
        {MAX_MESSAGE.toLocaleString("en")} characters.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Sending…" : "Send claim"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setOpen(false);
            setError(undefined);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function WaitingClaim({
  markerId,
  claim,
  onChanged,
}: {
  markerId: string;
  claim: MyClaim;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function withdraw() {
    setBusy(true);
    setError(undefined);
    try {
      await withdrawClaim(markerId, claim.id);
      onChanged();
    } catch (err) {
      setError(failed(err));
      setBusy(false);
    }
  }

  return (
    <section className="claim" aria-label="Your claim">
      <p role="status">Your claim is waiting for an admin.</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="secondary" disabled={busy} onClick={() => void withdraw()}>
        {busy ? "Withdrawing…" : "Withdraw claim"}
      </button>
    </section>
  );
}

function ClaimReview({
  markerId,
  review,
  onChanged,
  onApproved,
}: {
  markerId: string;
  review: ClaimToReview[];
  onChanged: () => void;
  onApproved: (result: MarkerResult) => void;
}) {
  const [busy, setBusy] = useState<string>();
  const [declining, setDeclining] = useState<string>();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const reasonField = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (declining) reasonField.current?.focus();
  }, [declining]);

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    setError(undefined);
    try {
      await action();
      setDeclining(undefined);
      setReason("");
      onChanged();
    } catch (err) {
      setError(failed(err));
    } finally {
      setBusy(undefined);
    }
  }

  const approve = (id: string) => run(id, async () => onApproved(await approveClaim(markerId, id)));
  const decline = (id: string) =>
    run(id, async () => {
      await declineClaim(markerId, id, reason.trim());
    });

  return (
    <section className="claim claim-review" aria-labelledby="claim-review-heading">
      <h3 id="claim-review-heading">
        {review.length === 1 ? "A claim to review" : `${review.length} claims to review`}
      </h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ul>
        {review.map((claim) => (
          <li key={claim.id}>
            <p>
              <strong>{claim.username}</strong> asked to become the owner
              {claimDate(claim.created_at) ? ` on ${claimDate(claim.created_at)}` : ""}:
            </p>
            <blockquote className="claim-message">{claim.message}</blockquote>
            {declining === claim.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void decline(claim.id);
                }}
              >
                <label htmlFor={`reason-${claim.id}`}>
                  Reason (optional, sent to {claim.username})
                </label>
                <textarea
                  id={`reason-${claim.id}`}
                  ref={reasonField}
                  rows={3}
                  maxLength={MAX_REASON}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="button-row">
                  <button type="submit" className="primary" disabled={busy !== undefined}>
                    {busy === claim.id ? "Declining…" : "Decline claim"}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setDeclining(undefined);
                      setReason("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="button-row">
                <button
                  type="button"
                  className="primary"
                  aria-label={`Approve ${claim.username}'s claim`}
                  disabled={busy !== undefined}
                  onClick={() => void approve(claim.id)}
                >
                  {busy === claim.id ? "Approving…" : "Approve"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Decline ${claim.username}'s claim`}
                  disabled={busy !== undefined}
                  onClick={() => {
                    setReason("");
                    setDeclining(claim.id);
                  }}
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
