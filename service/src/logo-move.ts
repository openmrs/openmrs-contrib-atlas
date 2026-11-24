import { TABS, type Cell } from "@openmrs-atlas/shared";
import type { CellUpdate } from "./edits/index.ts";

/**
 * Moving logo addresses in bulk (specs/marker-editing, "Logo addresses can be moved in bulk"):
 * every `logo_url` that starts with `from` is rewritten to start with `to` instead. Only those
 * cells change. Like an admin's own edit in the sheet, nothing is logged in `changes` and no
 * `confirmed_at` moves, so the change feed and freshness clocks are untouched.
 */
export interface LogoMove {
  /** 1-based sheet row. */
  row: number;
  id: string;
  to: string;
}

/** The prefixes must be whole addresses of a folder, so `…/logos/` can't match `…/logos-old/`. */
function checkPrefix(name: string, prefix: string): void {
  if (!/^https?:\/\/[^/]+\/.*\/$|^https?:\/\/[^/]+\/$/.test(prefix)) {
    throw new Error(
      `--${name} must be an http(s) address ending in "/", such as https://host/logos/`,
    );
  }
}

/** The moves for the `markers` tab's values, header row first. */
export function planLogoMove(markers: Cell[][], from: string, to: string): LogoMove[] {
  checkPrefix("from", from);
  checkPrefix("to", to);
  if (from === to) throw new Error("--from and --to are the same");
  const header = (markers[0] ?? []).map(String);
  const logo = header.indexOf("logo_url");
  const id = header.indexOf("id");
  if (logo < 0 || id < 0) throw new Error("the markers tab has no logo_url or id column");
  const moves: LogoMove[] = [];
  markers.slice(1).forEach((values, i) => {
    const url = values[logo];
    if (typeof url === "string" && url.startsWith(from)) {
      moves.push({ row: i + 2, id: String(values[id] ?? ""), to: to + url.slice(from.length) });
    }
  });
  return moves;
}

export interface LogoMoveStore {
  read(): Promise<{ markers: Cell[][] }>;
  updateCells(updates: CellUpdate[]): Promise<void>;
}

/** Plans the move and, with `apply`, writes it in one call. */
export async function moveLogoUrls(
  store: LogoMoveStore,
  options: { from: string; to: string; apply: boolean },
): Promise<{ moves: LogoMove[]; applied: boolean }> {
  const { markers } = await store.read();
  const moves = planLogoMove(markers, options.from, options.to);
  if (!options.apply || moves.length === 0) return { moves, applied: false };
  const column = (markers[0] ?? []).map(String).indexOf("logo_url");
  await store.updateCells(
    moves.map((m) => ({ tab: TABS.markers, row: m.row, column, value: m.to })),
  );
  return { moves, applied: true };
}
