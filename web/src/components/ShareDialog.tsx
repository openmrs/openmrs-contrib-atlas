import { useEffect, useId, useRef, useState } from "react";
import { saveBlob } from "../export/download.ts";
import { track } from "../lib/analytics.ts";
import {
  BADGE_ALT,
  BADGE_HEIGHT,
  BADGE_WIDTH,
  NETWORKS,
  badgeSnippet,
  badgeUrl,
  cardFileName,
  permalink,
  shareLinks,
  shareText,
  type BadgeTheme,
  type ShareMethod,
  type ShareSource,
} from "../lib/share.ts";
import type { PublicMarker } from "../lib/types.ts";

interface Props {
  marker: PublicMarker;
  source: ShareSource;
  onClose: () => void;
  /** The address links are built on: the one the visitor is using. */
  origin?: string;
}

const FOCUSABLE =
  "a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex='-1'])";
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/**
 * Ways to share one marker (specs/marker-sharing): its link, the networks' own share pages, the
 * device's share sheet, a badge for the implementation's website, and its card as an image.
 * Nothing is loaded from the networks.
 */
export function ShareDialog({ marker, source, onClose, origin = window.location.origin }: Props) {
  const headingId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const linkField = useRef<HTMLInputElement>(null);
  const snippetField = useRef<HTMLTextAreaElement>(null);
  const copyLink = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<BadgeTheme>("light");
  const [preview, setPreview] = useState(true);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const clearStatus = useRef<ReturnType<typeof setTimeout>>(undefined);

  const link = permalink(marker.id, origin);
  const links = shareLinks(marker, origin);
  const snippet = badgeSnippet(marker.id, origin, theme);
  const card = `/marker/${encodeURIComponent(marker.id)}/card.png`;
  const canShare = typeof navigator.share === "function";

  const record = (method: ShareMethod) => track("share", { method, source, marker_id: marker.id });

  // Focus moves in, and back to whatever opened the dialog when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    copyLink.current?.focus();
    return () => {
      clearTimeout(clearStatus.current);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // Escape closes only the dialog; Backspace mustn't reach the details' "back" behind it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  // Tab stays inside the dialog.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function say(message: string, fades = true) {
    clearTimeout(clearStatus.current);
    setError(undefined);
    setStatus(message);
    if (fades) clearStatus.current = setTimeout(() => setStatus(undefined), 4000);
  }

  async function copy(
    text: string,
    field: HTMLInputElement | HTMLTextAreaElement | null,
    method: ShareMethod,
    done: string,
  ) {
    record(method);
    try {
      await navigator.clipboard.writeText(text);
      say(done);
    } catch {
      // No clipboard here (or it refused): leave the text selected to copy by hand.
      field?.focus();
      field?.select();
      say(`Press ${isMac() ? "⌘C" : "Ctrl+C"} to copy.`, false);
    }
  }

  async function shareNatively() {
    record("native");
    try {
      await navigator.share({ title: marker.name, text: shareText(marker), url: link });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Sharing didn't work. Try one of the other options.");
      }
    }
  }

  async function download() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(card);
      if (res.status === 404) {
        setError("The image isn't ready yet. Try again in a few minutes.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      saveBlob(await res.blob(), cardFileName(marker.name));
      record("image_download");
      say("Image downloaded.");
    } catch {
      setError("The image couldn't be downloaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="share-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="share-dialog"
        onKeyDown={onKeyDown}
      >
        <div className="panel-header">
          <h2 id={headingId}>Share {marker.name}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>

        {preview && (
          <img
            className="share-card"
            src={card}
            alt={`${marker.name} on the OpenMRS Atlas`}
            width={1200}
            height={630}
            onError={() => setPreview(false)}
          />
        )}

        <div className="copy-row">
          <input
            ref={linkField}
            aria-label="Link"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            ref={copyLink}
            type="button"
            className="primary"
            onClick={() => void copy(link, linkField.current, "copy_link", "Link copied")}
          >
            Copy link
          </button>
        </div>

        <ul className="share-networks" aria-label="Share on">
          {NETWORKS.map((n) => (
            <li key={n.id}>
              <a
                className="button secondary"
                href={links[n.id]}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => record(n.id)}
              >
                {n.label}
              </a>
            </li>
          ))}
          {canShare && (
            <li>
              <button type="button" className="secondary" onClick={() => void shareNatively()}>
                More options…
              </button>
            </li>
          )}
        </ul>

        <section className="share-badge">
          <h3>Website badge</h3>
          <p className="hint">Add this to your website to link to {marker.name} on the Atlas.</p>
          <fieldset>
            <legend className="hint">Badge colour</legend>
            {(["light", "dark"] as const).map((t) => (
              <label key={t} className={`badge-choice ${t}`}>
                <input
                  type="radio"
                  name={`${headingId}-badge`}
                  value={t}
                  checked={theme === t}
                  onChange={() => setTheme(t)}
                />
                <span>{t === "light" ? "Light" : "Dark"}</span>
                <img src={badgeUrl(origin, t)} alt="" width={BADGE_WIDTH} height={BADGE_HEIGHT} />
              </label>
            ))}
          </fieldset>
          <textarea
            ref={snippetField}
            aria-label={`HTML for the badge (${BADGE_ALT})`}
            readOnly
            rows={5}
            value={snippet}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => void copy(snippet, snippetField.current, "badge_copy", "Code copied")}
          >
            Copy code
          </button>
        </section>

        <div className="share-download">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void download()}
          >
            Download image
          </button>
        </div>

        <p className="share-status" role="status">
          {status}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
