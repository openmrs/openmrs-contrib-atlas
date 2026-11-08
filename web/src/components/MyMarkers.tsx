import { needsConfirming } from "@openmrs-atlas/shared/freshness";
import { useEffect, useRef, useState } from "react";
import { config } from "../config.ts";
import { ApiError, api, markerPath, type Me, type MarkerResult } from "../lib/api.ts";
import { useEscape } from "./useEscape.ts";

interface Props {
  me: Me;
  onOpen: (id: string) => void;
  onResult: (id: string, result: MarkerResult) => void;
  onChanged: () => void;
  onAdd: () => void;
  onSignOut: () => void;
  onClose: () => void;
  /** The marker the person came back from, whose entry gets focus. */
  focusId?: string;
}

const monthYear = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function lastConfirmedLabel(iso: string): string {
  return iso ? `Last confirmed ${monthYear.format(new Date(iso))}.` : "Never confirmed.";
}

/** Everything a person owns or edits, and the offers waiting for their answer. */
export function MyMarkers({
  me,
  onOpen,
  onResult,
  onChanged,
  onAdd,
  onSignOut,
  onClose,
  focusId,
}: Props) {
  useEscape(onClose);
  const list = useRef<HTMLUListElement>(null);
  const [updating, setUpdating] = useState<string>();

  // Back from a marker: return to its entry, where the person left the list.
  useEffect(() => {
    if (!focusId) return;
    const entry = list.current?.querySelector<HTMLButtonElement>(
      `button[data-marker-id="${CSS.escape(focusId)}"]`,
    );
    entry?.focus();
    entry?.scrollIntoView?.({ block: "nearest" });
  }, [focusId]);
  const [error, setError] = useState<string>();
  const [reminders, setReminders] = useState(me.reminders !== false);
  const [savingReminders, setSavingReminders] = useState(false);

  async function changeReminders(on: boolean) {
    setError(undefined);
    setSavingReminders(true);
    setReminders(on);
    try {
      const result = await api<{ reminders: boolean }>("/me/reminders", "PUT", { on });
      setReminders(result.reminders);
    } catch (err) {
      setReminders(!on);
      setError(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setSavingReminders(false);
    }
  }

  /** "Update": confirms a marker 12 months past its last confirmation, without opening it. */
  async function update(id: string) {
    setError(undefined);
    setUpdating(id);
    try {
      onResult(id, await api<MarkerResult>(`${markerPath(id)}/confirm`, "POST"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    } finally {
      setUpdating(undefined);
    }
  }

  async function answer(id: string, verb: "accept" | "decline") {
    setError(undefined);
    try {
      const result = await api<MarkerResult>(`${markerPath(id)}/transfer/${verb}`, "POST");
      if (verb === "accept") onResult(id, result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
    }
    onChanged();
  }

  return (
    <aside className="panel my-markers" aria-label="My markers">
      <div className="panel-header">
        <h2>My markers</h2>
        <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="hint">
        Signed in as {me.username}
        {me.admin ? " (admin)" : ""}.{" "}
        <button type="button" className="link" onClick={onSignOut}>
          Sign out
        </button>
      </p>
      <div className="button-row add-site">
        <button type="button" className="primary" onClick={onAdd}>
          Add a site
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {me.offers.length > 0 && (
        <section aria-label="Offers waiting for you">
          <h3>Waiting for your answer</h3>
          <ul className="marker-list">
            {me.offers.map((offer) => (
              <li key={offer.marker_id}>
                <p>
                  <strong>{offer.name}</strong>: {offer.from} offered you ownership.
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void answer(offer.marker_id, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void answer(offer.marker_id, "decline")}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {me.markers.length === 0 ? (
        <p>You don't own or edit any markers yet.</p>
      ) : (
        <ul className="marker-list" ref={list}>
          {me.markers.map((marker) => (
            <li key={marker.id}>
              <button
                type="button"
                className="link"
                data-marker-id={marker.id}
                onClick={() => onOpen(marker.id)}
              >
                {marker.name || "(no name)"}
              </button>
              <p className="hint">
                {marker.role === "owner" ? "Owner" : "Editor"}
                {marker.status !== "active" ? `, ${marker.status}` : ""}.{" "}
                {lastConfirmedLabel(marker.confirmed_at)}
                {marker.status === "active" && needsConfirming(marker.confirmed_at, new Date()) && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="link"
                      aria-label={`Mark ${marker.name || "this marker"} still current`}
                      disabled={updating !== undefined}
                      onClick={() => void update(marker.id)}
                    >
                      {updating === marker.id ? "Updating…" : "Update"}
                    </button>
                  </>
                )}
              </p>
              {marker.problems && (
                <p className="error">Needs fixing: {marker.problems.join("; ")}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <section className="reminder-setting" aria-label="Reminders">
        <h3>Reminders</h3>
        <label>
          <input
            type="checkbox"
            checked={reminders}
            disabled={savingReminders}
            onChange={(e) => void changeReminders(e.target.checked)}
          />
          Email me when my markers need confirming
        </label>
        <p className="hint">
          {me.email ? (
            <>Reminders go to {me.email}, the email on your OpenMRS ID. </>
          ) : (
            <>Your OpenMRS ID has no email, so reminders can't reach you. </>
          )}
          {config.keycloakIssuer && (
            <a href={`${config.keycloakIssuer}/account`} target="_blank" rel="noreferrer">
              {me.email ? "Change it" : "Add one"} in your OpenMRS ID account
            </a>
          )}
        </p>
      </section>
    </aside>
  );
}
