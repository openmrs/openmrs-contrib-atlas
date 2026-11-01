import { useEffect, useId, useMemo, useRef, useState } from "react";
import { countryName } from "../lib/countries.ts";
import { searchMarkers } from "../lib/search.ts";
import type { PublicMarker } from "../lib/types.ts";

interface Props {
  markers: PublicMarker[];
  onPick: (marker: PublicMarker) => void;
}

/** Keys that type into these are left alone. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/** A combobox: "/" to focus, type to search, arrow keys to move, Enter to pick, Escape to clear. */
export function SearchBox({ markers, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => searchMarkers(markers, query), [markers, query]);
  const open = results.length > 0;
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function pick(marker: PublicMarker) {
    onPick(marker);
    setQuery("");
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      pick(results[active]!);
    } else if (e.key === "Escape") {
      // Escape here belongs to the search box, not to an open marker panel.
      e.stopPropagation();
      setQuery("");
    }
  }

  return (
    <div className="search">
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Search sites by name, organisation or country"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        placeholder="Search sites or countries"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul id={listId} role="listbox" className="search-results">
          {results.map((m, i) => (
            <li
              key={m.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(m)}
            >
              <span className="result-name">{m.name}</span>
              <span className="result-meta">
                {[m.organisation, countryName(m.country)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
