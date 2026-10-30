import type { LegendEntry } from "../lib/colours.ts";
import type { ColourBy } from "../lib/types.ts";

interface Props {
  colourBy: ColourBy;
  entries: LegendEntry[];
  onColourByChange: (by: ColourBy) => void;
}

export function Legend({ colourBy, entries, onColourByChange }: Props) {
  return (
    <section className="legend" aria-label="Legend">
      <label>
        Colour by{" "}
        <select value={colourBy} onChange={(e) => onColourByChange(e.target.value as ColourBy)}>
          <option value="type">type</option>
          <option value="distribution">distribution</option>
          <option value="version">version</option>
        </select>
      </label>
      <ul>
        {entries.map((e) => (
          <li key={e.value}>
            <span className="swatch" style={{ background: e.colour }} aria-hidden="true" />
            {e.value}
          </li>
        ))}
      </ul>
    </section>
  );
}
