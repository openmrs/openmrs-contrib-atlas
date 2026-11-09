import { useEffect, useRef } from "react";
import { countryName } from "../lib/countries.ts";
import { lastConfirmed } from "../lib/freshness.ts";
import { linkify } from "../lib/linkify.ts";
import type { PublicMarker } from "../lib/types.ts";
import { ShareIcon } from "./Icons.tsx";
import { useEscape } from "./useEscape.ts";

const monthYear = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

interface Props {
  marker: PublicMarker;
  onClose: () => void;
  /** Set when the marker was opened from a list: a "<" control and Backspace return there. */
  onBack?: () => void;
  /** Names where "<" goes, such as "Back to My markers". */
  backLabel?: string;
  /** Opens the Share dialog; offered to everyone (specs/marker-sharing). */
  onShare?: () => void;
  /** Controls for those allowed to change this marker. */
  children?: React.ReactNode;
}

/** Details for one marker. Blank fields are left out; notes are plain text with links. */
export function MarkerDetails({
  marker,
  onClose,
  onBack,
  backLabel = "Back to My markers",
  onShare,
  children,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [marker.id]);

  useEscape(onClose);

  // Backspace (Delete on a Mac) goes back, unless the person is typing or holding a modifier.
  useEffect(() => {
    if (!onBack) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      onBack();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const confirmed = lastConfirmed(marker);
  const rows: [string, React.ReactNode][] = [];
  if (marker.status === "closed") rows.push(["Status", "Closed"]);
  if (marker.organisation) rows.push(["Organisation", marker.organisation]);
  if (marker.country) rows.push(["Country", countryName(marker.country)]);
  rows.push(["Type", marker.type]);
  if (marker.distribution) rows.push(["Distribution", marker.distribution]);
  if (marker.openmrs_version) rows.push(["OpenMRS version", marker.openmrs_version]);
  if (marker.site_count && marker.site_count > 1) rows.push(["Sites", marker.site_count]);
  if (confirmed) rows.push(["Last confirmed", monthYear.format(new Date(confirmed))]);

  return (
    <aside className="panel details" aria-label={`Details for ${marker.name}`}>
      <div className="panel-header">
        {onBack && (
          <button
            type="button"
            className="icon-button back"
            aria-label={backLabel}
            onClick={onBack}
          >
            &lt;
          </button>
        )}
        <h2 ref={heading} tabIndex={-1}>
          {marker.name}
        </h2>
        <button type="button" className="icon-button" aria-label="Close details" onClick={onClose}>
          ×
        </button>
      </div>
      {marker.logo_url && <img className="logo" src={marker.logo_url} alt="" />}
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {marker.url && (
        <p>
          <a href={marker.url} target="_blank" rel="noopener noreferrer">
            Website
          </a>
        </p>
      )}
      {marker.notes && (
        <p className="notes">
          {linkify(marker.notes).map((part, i) =>
            "url" in part ? (
              <a key={i} href={part.url} target="_blank" rel="noopener noreferrer">
                {part.url}
              </a>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </p>
      )}
      {onShare && (
        <button type="button" className="secondary share-button" onClick={onShare}>
          <ShareIcon />
          Share
        </button>
      )}
      {children}
    </aside>
  );
}
