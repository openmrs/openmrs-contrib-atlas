import { useEffect, useRef } from "react";
import { countryName } from "../lib/countries.ts";
import { lastConfirmed } from "../lib/freshness.ts";
import { linkify } from "../lib/linkify.ts";
import type { PublicMarker } from "../lib/types.ts";

const monthYear = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

interface Props {
  marker: PublicMarker;
  onClose: () => void;
}

/** Details for one marker. Blank fields are left out; notes are plain text with links. */
export function MarkerDetails({ marker, onClose }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [marker.id]);

  // On the document, because focus moves to the map when it is tapped or dragged.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const confirmed = lastConfirmed(marker);
  const rows: [string, React.ReactNode][] = [];
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
    </aside>
  );
}
