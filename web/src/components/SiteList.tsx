import { useEffect, useRef } from "react";
import { LIST_SORTS, entryMeta, type ListSort } from "../lib/list.ts";
import type { PublicMarker } from "../lib/types.ts";
import { useEscape } from "./useEscape.ts";

const count = new Intl.NumberFormat("en");

interface Props {
  /** The markers in view, already filtered and sorted. */
  markers: PublicMarker[];
  sort: ListSort;
  onSortChange: (sort: ListSort) => void;
  onOpen: (marker: PublicMarker) => void;
  onClose: () => void;
  /** The marker the person came back from, whose entry gets focus. */
  focusId?: string;
}

/** The markers in the map's visible area that match the filters (specs/site-list). */
export function SiteList({ markers, sort, onSortChange, onOpen, onClose, focusId }: Props) {
  useEscape(onClose);
  const list = useRef<HTMLUListElement>(null);

  // Back from a marker: return to its entry.
  useEffect(() => {
    if (!focusId) return;
    const entry = list.current?.querySelector<HTMLButtonElement>(
      `button[data-marker-id="${CSS.escape(focusId)}"]`,
    );
    entry?.focus();
    entry?.scrollIntoView?.({ block: "nearest" });
  }, [focusId]);

  return (
    <aside className="panel site-list" aria-label="List of implementations in view">
      <div className="panel-header">
        <h2 aria-live="polite">
          {count.format(markers.length)}{" "}
          {markers.length === 1 ? "implementation" : "implementations"} in view
        </h2>
        <button type="button" className="icon-button" aria-label="Close list" onClick={onClose}>
          ×
        </button>
      </div>
      <label className="sort-by">
        Sort by
        <select value={sort} onChange={(e) => onSortChange(e.target.value as ListSort)}>
          {LIST_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {markers.length === 0 ? (
        <p className="hint empty">
          No implementations are in view. Zoom out or move the map, or clear the filters.
        </p>
      ) : (
        <ul className="site-entries" ref={list}>
          {markers.map((marker) => (
            <li key={marker.id}>
              <button type="button" data-marker-id={marker.id} onClick={() => onOpen(marker)}>
                <span className="site-name">
                  {marker.name}
                  {marker.status === "closed" && <span className="tag">Closed</span>}
                </span>
                <span className="site-meta">{entryMeta(marker)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
