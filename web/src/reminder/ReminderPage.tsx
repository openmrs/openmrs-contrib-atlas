import { useEffect, useState } from "react";
import { config } from "../config.ts";

/**
 * The page behind "Still current" and "Unsubscribe" links in reminder emails. Opening it only
 * shows what the link is for; nothing changes until the button is pressed, so mail scanners
 * that open links can't confirm or unsubscribe anyone. See specs/reminder-emails.
 */

interface LinkMarker {
  id: string;
  name: string;
  organisation?: string;
  status?: string;
  confirmed_at?: string;
}

type View =
  | { purpose: "confirm"; state: string; marker?: LinkMarker }
  | { purpose: "unsubscribe"; state: string; username?: string }
  | { purpose?: undefined; state: string };

type Phase =
  | { kind: "loading" }
  | { kind: "view"; view: View }
  | { kind: "working"; view: View }
  | { kind: "done"; view: View; confirmedAt?: string }
  | { kind: "after"; view: View; state: string; confirmedAt?: string };

const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const formatDate = (iso: string | undefined, format = dayMonthYear) =>
  iso && !Number.isNaN(new Date(iso).getTime()) ? format.format(new Date(iso)) : "";

async function post(path: string, token: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${config.apiBaseUrl}/reminder/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return { status: res.status, body: await res.json().catch(() => ({ state: "error" })) };
}

const mapLink = (id?: string) => (id ? `/?marker=${encodeURIComponent(id)}` : "/");

export function ReminderPage({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>(() =>
    token ? { kind: "loading" } : { kind: "view", view: { state: "invalid" } },
  );

  useEffect(() => {
    if (!token) return;
    let live = true;
    post("view", token)
      .then(({ body }) => {
        if (live) setPhase({ kind: "view", view: body as View });
      })
      .catch(() => {
        if (live) setPhase({ kind: "view", view: { state: "error" } });
      });
    return () => {
      live = false;
    };
  }, [token]);

  async function act(view: View) {
    setPhase({ kind: "working", view });
    try {
      const path = view.purpose === "unsubscribe" ? "unsubscribe" : "confirm";
      const { status, body } = await post(path, token);
      const result = body as { state: string; confirmed_at?: string };
      if (status === 200) setPhase({ kind: "done", view, confirmedAt: result.confirmed_at });
      else setPhase({ kind: "after", view, state: result.state, confirmedAt: result.confirmed_at });
    } catch {
      setPhase({ kind: "after", view, state: "error" });
    }
  }

  return (
    <div className="reminder-page">
      <header className="topbar">
        <h1>
          <a href="/">
            <img className="logo" src="/openmrs-cross.png" alt="" width="28" height="28" />
            <span className="wordmark">
              OpenMRS <span>Atlas</span>
            </span>
          </a>
        </h1>
      </header>
      <main className="reminder-card" aria-live="polite">
        <Body phase={phase} onAct={(view) => void act(view)} />
      </main>
    </div>
  );
}

function Body({ phase, onAct }: { phase: Phase; onAct: (view: View) => void }) {
  if (phase.kind === "loading") return <p>Checking your link…</p>;
  const { view } = phase;
  const marker = view.purpose === "confirm" ? view.marker : undefined;
  const name = marker?.name || "This marker";

  if (phase.kind === "done") {
    return view.purpose === "unsubscribe" ? (
      <>
        <h2>You're unsubscribed</h2>
        <p>You won't get any more reminder emails from the OpenMRS Atlas.</p>
        <p>
          To turn them back on, sign in to the Atlas and open <strong>My markers</strong>.
        </p>
        <p>
          <a href="/">Go to the Atlas</a>
        </p>
      </>
    ) : (
      <>
        <h2>Thank you</h2>
        <p>
          <strong>{name}</strong> is confirmed as still current
          {phase.confirmedAt ? ` as of ${formatDate(phase.confirmedAt)}` : ""}. It's shown at full
          strength on the map again, and others will see that within 10 minutes.
        </p>
        <p>
          <a href={mapLink(marker?.id)}>See it on the map</a>
        </p>
      </>
    );
  }

  const state = phase.kind === "after" ? phase.state : view.state;
  const confirmedAt =
    phase.kind === "after" && phase.confirmedAt ? phase.confirmedAt : marker?.confirmed_at;

  switch (state) {
    case "ready":
      return view.purpose === "unsubscribe" ? (
        <>
          <h2>Stop reminder emails?</h2>
          <p>
            The OpenMRS Atlas emails{" "}
            {view.username ? (
              <>
                OpenMRS ID <strong>{view.username}</strong>
              </>
            ) : (
              "you"
            )}{" "}
            when markers they own or edit haven't been confirmed for a while.
          </p>
          <button
            type="button"
            className="primary"
            disabled={phase.kind === "working"}
            onClick={() => onAct(view)}
          >
            {phase.kind === "working" ? "Unsubscribing…" : "Unsubscribe"}
          </button>
        </>
      ) : (
        <>
          <h2>Is {name} still current?</h2>
          {marker?.organisation && <p className="hint">{marker.organisation}</p>}
          <p>
            {confirmedAt
              ? `Last confirmed ${formatDate(confirmedAt, monthYear)}. `
              : "Not confirmed yet. "}
            If its details on the Atlas are still right, confirm it to keep it at full strength on
            the map.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="primary"
              disabled={phase.kind === "working"}
              onClick={() => onAct(view)}
            >
              {phase.kind === "working" ? "Confirming…" : "Still current"}
            </button>
            <a className="secondary-link" href={mapLink(marker?.id)}>
              Something has changed
            </a>
          </div>
          <p className="hint">
            "Something has changed" opens it on the map, where you can sign in to update it or mark
            the site as closed.
          </p>
        </>
      );
    case "confirmed":
      return (
        <>
          <h2>Already confirmed</h2>
          <p>
            <strong>{name}</strong> was confirmed
            {confirmedAt ? ` on ${formatDate(confirmedAt)}` : " already"}, so there's nothing more
            to do.
          </p>
          <p>
            <a href={mapLink(marker?.id)}>See it on the map</a>
          </p>
        </>
      );
    case "expired":
      return view.purpose === "unsubscribe" ? (
        <>
          <h2>This link has expired</h2>
          <p>
            Sign in to the Atlas and open <strong>My markers</strong> to turn reminders off.
          </p>
          <p>
            <a href="/">Go to the Atlas</a>
          </p>
        </>
      ) : (
        <>
          <h2>This link has expired</h2>
          <p>Links in reminder emails work for 30 days. You can still confirm it from the map.</p>
          <p>
            <a href={mapLink(marker?.id)}>Open {marker?.name || "it"} on the map</a>, sign in, and
            choose <strong>Still current</strong>.
          </p>
        </>
      );
    case "inactive":
      return (
        <>
          <h2>Nothing to confirm</h2>
          <p>
            <strong>{name}</strong> is {marker?.status === "closed" ? "closed" : "not on the map"}{" "}
            just now, so it can't be confirmed from here.
          </p>
          <p>
            <a href={mapLink(marker?.id)}>Open the Atlas</a>
          </p>
        </>
      );
    case "gone":
      return (
        <>
          <h2>Marker not found</h2>
          <p>That marker is no longer on the OpenMRS Atlas.</p>
          <p>
            <a href="/">Go to the Atlas</a>
          </p>
        </>
      );
    case "error":
      return (
        <>
          <h2>Something went wrong</h2>
          <p>We couldn't reach the Atlas just now. Please try the link again in a few minutes.</p>
        </>
      );
    default:
      return (
        <>
          <h2>This link isn't valid</h2>
          <p>
            It may have been cut short when it was copied. Try opening it straight from the email,
            or sign in to the Atlas and confirm your markers from <strong>My markers</strong>.
          </p>
          <p>
            <a href="/">Go to the Atlas</a>
          </p>
        </>
      );
  }
}
