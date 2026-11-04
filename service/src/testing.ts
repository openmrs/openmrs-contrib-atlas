import { COLUMNS, TABS, type Cell, type Problem } from "@openmrs-atlas/shared";
import { SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";
import type { CellUpdate, EditStore, EditValues } from "./edits.ts";
import type { PublicFile, SheetStore, SheetValues, SnapshotStore } from "./publish.ts";

/** In-memory stand-ins for the sheet and bucket, shared by the service tests. */

export const ID = "00000000-0000-4000-8000-000000000001";
export const OLD = "2022-01-01T00:00:00.000Z";
export const NOW = new Date("2026-11-02T12:00:00.000Z");
export const NOW_ISO = NOW.toISOString();
export const SECRET_EMAIL = "secret-contact@example.org";

type Tab = keyof typeof TABS;

/** The sheet in memory, behaving as Sheets does: blank rows stay, cleared rows are blank. */
export class FakeSheet implements SheetStore, EditStore {
  tabs: Record<string, Cell[][]>;
  problems: Problem[] = [];
  constructor() {
    this.tabs = {
      markers: [
        [...COLUMNS.markers],
        COLUMNS.markers.map(
          (c) =>
            (
              ({
                id: ID,
                name: "Clinic",
                latitude: -1.29,
                longitude: 36.82,
                type: "Clinical",
                created_at: OLD,
                updated_at: OLD,
                confirmed_at: OLD,
                status: "active",
              }) as Record<string, Cell>
            )[c] ?? "",
        ),
      ],
      private: [[...COLUMNS.private], [ID, "jdoe", "asmith", "J Doe", SECRET_EMAIL]],
      pending: [[...COLUMNS.pending]],
      changes: [[...COLUMNS.changes]],
      reminders: [[...COLUMNS.reminders]],
      unsubscribed: [[...COLUMNS.unsubscribed]],
    };
  }
  async read(): Promise<SheetValues> {
    return {
      markers: this.tabs.markers!,
      types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
      distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
      versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
      changes: this.tabs.changes!,
    };
  }
  async readEdits(): Promise<EditValues> {
    return {
      ...(await this.read()),
      private: this.tabs.private!,
      pending: this.tabs.pending!,
      reminders: this.tabs.reminders!,
      unsubscribed: this.tabs.unsubscribed!,
    };
  }
  async writeProblems(problems: Problem[]) {
    this.problems = problems;
  }
  async appendRow(tab: Tab, cells: Cell[]) {
    this.tabs[tab]!.push(cells);
  }
  async appendRows(tab: Tab, rows: Cell[][]) {
    this.tabs[tab]!.push(...rows);
  }
  async updateCells(updates: CellUpdate[]) {
    for (const u of updates) this.tabs[u.tab]![u.row - 1]![u.column] = u.value;
  }
  async clearRow(tab: Tab, row: number) {
    this.tabs[tab]![row - 1] = [];
  }
  async readCell(tab: Tab, row: number, column: number) {
    return this.tabs[tab]![row - 1]![column];
  }

  marker(field: string, row = 1): Cell {
    return this.tabs.markers![row]![COLUMNS.markers.indexOf(field as never)];
  }
  setMarker(field: string, value: Cell) {
    this.tabs.markers![1]![COLUMNS.markers.indexOf(field as never)] = value;
  }
  priv(field: string, row = 1): Cell {
    return this.tabs.private![row]![COLUMNS.private.indexOf(field as never)];
  }
  lastChange() {
    const [timestamp, user, marker_id, action, fields] = this.tabs.changes!.at(-1)!;
    return { timestamp, user, marker_id, action, fields: JSON.parse(String(fields)) };
  }
}

export class FakeBucket implements SnapshotStore {
  files = new Map<string, PublicFile>();
  writes = 0;
  failing = false;
  async currentCount() {
    return undefined;
  }
  async write(files: PublicFile[]) {
    if (this.failing) throw new Error("storage down");
    this.writes++;
    for (const f of files) this.files.set(f.name, f);
  }
}
