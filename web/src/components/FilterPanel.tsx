import { useMemo } from "react";
import { countryName } from "../lib/countries.ts";
import { hasFilters } from "../lib/filters.ts";
import { NO_FILTERS, UNKNOWN, type Filters, type PublicMarker } from "../lib/types.ts";

interface Props {
  markers: PublicMarker[];
  /** Lookup order for each list, so options read in a sensible order. */
  order: { types: string[]; distributions: string[]; versions: string[] };
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClose: () => void;
}

type ListKey = "types" | "distributions" | "versions" | "countries";

function present(markers: PublicMarker[], pick: (m: PublicMarker) => string | undefined) {
  return new Set(markers.map((m) => pick(m) ?? UNKNOWN));
}

function ordered(values: Set<string>, order: string[]): string[] {
  const known = order.filter((v) => values.has(v));
  const rest = [...values].filter((v) => v !== UNKNOWN && !order.includes(v)).sort();
  return [...known, ...rest, ...(values.has(UNKNOWN) ? [UNKNOWN] : [])];
}

export function FilterPanel({ markers, order, filters, onChange, onClose }: Props) {
  const options = useMemo(() => {
    const countries = [...present(markers, (m) => m.country)]
      .filter((c) => c !== UNKNOWN)
      .sort((a, b) => countryName(a).localeCompare(countryName(b)));
    return {
      types: ordered(
        present(markers, (m) => m.type),
        order.types,
      ),
      distributions: ordered(
        present(markers, (m) => m.distribution),
        order.distributions,
      ),
      versions: ordered(
        present(markers, (m) => m.openmrs_version),
        [...order.versions, "Other"],
      ),
      countries,
    };
  }, [markers, order]);

  function toggle(key: ListKey, value: string, on: boolean) {
    const current = filters[key];
    onChange({ ...filters, [key]: on ? [...current, value] : current.filter((v) => v !== value) });
  }

  function group(key: ListKey, legend: string, label = (v: string) => v) {
    return (
      <fieldset>
        <legend>{legend}</legend>
        {options[key].map((value) => (
          <label key={value}>
            <input
              type="checkbox"
              checked={filters[key].includes(value)}
              onChange={(e) => toggle(key, value, e.target.checked)}
            />
            {label(value)}
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <aside className="panel filter-panel" aria-label="Filters">
      <div className="panel-header">
        <h2>Filters</h2>
        <button type="button" className="icon-button" aria-label="Close filters" onClick={onClose}>
          ×
        </button>
      </div>
      <label className="confirmed">
        Confirmed within
        <select
          value={filters.confirmedWithinYears ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              confirmedWithinYears: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">Any time</option>
          {[1, 2, 3, 5].map((y) => (
            <option key={y} value={y}>
              the last {y === 1 ? "year" : `${y} years`}
            </option>
          ))}
        </select>
      </label>
      {group("types", "Type")}
      {group("distributions", "Distribution")}
      {group("versions", "OpenMRS version")}
      {group("countries", "Country", countryName)}
      <button
        type="button"
        className="secondary"
        disabled={!hasFilters(filters)}
        onClick={() => onChange(NO_FILTERS)}
      >
        Clear filters
      </button>
    </aside>
  );
}
