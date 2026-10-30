import type { Stats } from "../lib/stats.ts";

const fmt = new Intl.NumberFormat("en");

export function StatsBar({ stats }: { stats: Stats }) {
  const items: [string, number][] = [
    ["sites", stats.sites],
    ["implementations", stats.markers],
    ["countries", stats.countries],
    ["confirmed in the last 2 years", stats.confirmedLastTwoYears],
  ];
  return (
    <dl className="stats" aria-label="Headline stats">
      {items.map(([label, value]) => (
        <div key={label} data-stat={label}>
          <dt>{label}</dt>
          <dd>{fmt.format(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
