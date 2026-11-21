import {
  can,
  checkMarkerRow,
  isPublished,
  normaliseUsername,
  roleOn,
  text,
  toPublicMarker,
  type Action,
  type Cell,
  type FieldError,
  type Person,
  type RawRow,
} from "@openmrs-atlas/shared";
import { AccountsUnavailable, type Accounts } from "../accounts.ts";
import {
  ApiError,
  Tabs,
  accountsUnavailable,
  forbidden,
  notFound,
  type CellUpdate,
  type EditStore,
  type MarkerResult,
  type Offer,
} from "./core.ts";

/**
 * What every editor shares: the store and clock, reading the tabs, permission checks, offers,
 * the change log and writes. Each method reads the sheet afresh and must run inside the write
 * queue. Permissions are checked here, never in the browser.
 */
export class EditorBase {
  protected store: EditStore;
  protected now: () => Date;
  protected accounts: Accounts | undefined;
  protected logoPrefix: string | undefined;

  /**
   * Without `accounts`, OpenMRS IDs are accepted unchecked (specs/account-lookup). With
   * `logoPrefix`, a `logo_url` set through the Atlas must start with it (specs/marker-editing).
   */
  constructor(
    store: EditStore,
    now: () => Date,
    accounts?: Accounts,
    options: { logoPrefix?: string } = {},
  ) {
    this.store = store;
    this.now = now;
    this.accounts = accounts;
    this.logoPrefix = options.logoPrefix;
  }

  /** A logo set through the Atlas must be an upload, so visitors' browsers load only the bucket. */
  protected checkLogo(changed: Record<string, Cell>): FieldError[] {
    if (!this.logoPrefix || !("logo_url" in changed)) return [];
    const url = text(changed.logo_url);
    if (!url || url.startsWith(this.logoPrefix)) return [];
    return [{ field: "logo_url", reason: "logo_url must be a logo uploaded to the Atlas" }];
  }

  /** Refuses OpenMRS IDs that don't exist or are disabled, before anything is written. */
  protected async requireAccounts(usernames: string[], field: string) {
    if (!this.accounts) return;
    for (const username of usernames) {
      let ok: boolean;
      try {
        ok = await this.accounts.check(username);
      } catch (err) {
        if (err instanceof AccountsUnavailable) {
          console.error(JSON.stringify({ event: "accounts-unavailable", message: err.message }));
          throw accountsUnavailable();
        }
        throw err;
      }
      if (!ok) {
        throw new ApiError(422, {
          error: "Please check the OpenMRS ID.",
          errors: [{ field, reason: `The OpenMRS ID "${username}" was not found.` }],
        });
      }
    }
  }

  protected async tabs() {
    return new Tabs(await this.store.readEdits());
  }

  protected stamp() {
    return this.now().toISOString();
  }

  /** The marker, or 404; deleted markers exist only for admins. */
  protected find(tabs: Tabs, person: Person, id: string, action: Action) {
    const marker = tabs.marker(id);
    if (!marker) throw notFound();
    if (text(marker.cells.status) === "deleted" && !person.admin) throw notFound();
    const priv = tabs.privateOf(id);
    const role = roleOn(person, priv);
    if (!can(role, action)) throw forbidden();
    return { marker, priv, role: role! };
  }

  protected openOffer(tabs: Tabs, id: string): Offer | undefined {
    const now = this.now().getTime();
    const owner = normaliseUsername(tabs.privateOf(id)?.owner ?? "");
    return tabs.offers.find(
      (o) =>
        o.marker_id === id &&
        new Date(o.expires_at).getTime() > now &&
        // An owner changed directly in the sheet ends any offer from the old one.
        normaliseUsername(o.from) === owner,
    );
  }

  /** Removes this marker's offers and any expired ones. */
  protected async clearOffers(tabs: Tabs, id: string) {
    const now = this.now().getTime();
    for (const offer of tabs.offers) {
      if (offer.marker_id === id || new Date(offer.expires_at).getTime() <= now) {
        await this.store.clearRow("pending", offer.row);
      }
    }
  }

  protected async log(person: Person | string, id: string, action: string, fields: unknown[]) {
    await this.store.appendRow("changes", [
      this.stamp(),
      typeof person === "string" ? person : person.username,
      id,
      action,
      JSON.stringify(fields),
    ]);
  }

  /**
   * Writes a marker's cells and its `private` cells in one call, then checks the row and adds the
   * change-log entry together. A missing `private` row is appended first.
   */
  protected async save(
    tabs: Tabs,
    marker: RawRow,
    markerCells: Record<string, Cell>,
    options: { privateCells?: Record<string, Cell>; log?: LogEntry } = {},
  ) {
    const id = text(marker.cells.id);
    const updates = cellUpdates("markers", tabs.header.markers, marker.row, markerCells);
    const privateCells = options.privateCells ?? {};
    if (Object.keys(privateCells).length > 0) {
      const existing = tabs.privateOf(id);
      if (existing) {
        updates.push(...cellUpdates("private", tabs.header.private, existing.row, privateCells));
      } else {
        await this.writePrivate(tabs, id, privateCells);
      }
    }
    if (updates.length > 0) await this.store.updateCells(updates);
    const { log } = options;
    await Promise.all([
      this.checkRow(tabs, marker),
      log && this.log(log.person, id, log.action, log.fields),
    ]);
  }

  private async checkRow(tabs: Tabs, marker: RawRow) {
    const id = text(marker.cells.id);
    const found = await this.store.readCell(
      "markers",
      marker.row,
      tabs.header.markers.indexOf("id"),
    );
    if (text(found) !== id) {
      // A person moved rows in the sheet between the read and the write. Version history recovers.
      console.error(JSON.stringify({ event: "row-moved", marker: id, row: marker.row }));
    }
  }

  protected async writePrivate(tabs: Tabs, id: string, changes: Record<string, Cell>) {
    const header = tabs.header.private;
    const existing = tabs.privateOf(id);
    if (existing) {
      await this.store.updateCells(cellUpdates("private", header, existing.row, changes));
    } else {
      const cells: Record<string, Cell> = { id, ...changes };
      await this.store.appendRow(
        "private",
        header.map((column) => cells[column] ?? ""),
      );
    }
  }

  protected result(tabs: Tabs, cells: Record<string, Cell>, publish: boolean): MarkerResult {
    const { marker } = checkMarkerRow(cells, tabs.lookups);
    return {
      version: text(cells.updated_at),
      status: text(cells.status),
      marker: marker && isPublished(marker.status) ? toPublicMarker(marker) : null,
      publish,
    };
  }

  /**
   * Restarts the freshness clock: this marker is evidently in use. Any `private` cells and the
   * change-log entry are saved with it (see `save`).
   */
  protected async restartClock(
    tabs: Tabs,
    marker: RawRow,
    options: { privateCells?: Record<string, Cell>; log?: LogEntry } = {},
  ): Promise<MarkerResult> {
    const stamp = this.stamp();
    const changes = { updated_at: stamp, confirmed_at: stamp };
    await this.save(tabs, marker, changes, options);
    return this.result(tabs, { ...marker.cells, ...changes }, true);
  }
}

/** A change-log entry written alongside a save. */
export interface LogEntry {
  person: Person | string;
  action: string;
  fields: unknown[];
}

function cellUpdates(
  tab: "markers" | "private",
  header: readonly string[],
  row: number,
  changes: Record<string, Cell>,
): CellUpdate[] {
  return Object.entries(changes).map(([field, value]) => ({
    tab,
    row,
    column: header.indexOf(field),
    value,
  }));
}
