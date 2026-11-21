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

  /** Writes only the given cells, then checks that the row still holds this marker. */
  protected async writeMarker(tabs: Tabs, marker: RawRow, changes: Record<string, Cell>) {
    const header = tabs.header.markers;
    await this.store.updateCells(
      Object.entries(changes).map(([field, value]) => ({
        tab: "markers" as const,
        row: marker.row,
        column: header.indexOf(field),
        value,
      })),
    );
    const id = text(marker.cells.id);
    const found = await this.store.readCell("markers", marker.row, header.indexOf("id"));
    if (text(found) !== id) {
      // A person moved rows in the sheet between the read and the write. Version history recovers.
      console.error(JSON.stringify({ event: "row-moved", marker: id, row: marker.row }));
    }
  }

  protected async writePrivate(tabs: Tabs, id: string, changes: Record<string, Cell>) {
    const header = tabs.header.private;
    const existing = tabs.privateOf(id);
    if (existing) {
      await this.store.updateCells(
        Object.entries(changes).map(([field, value]) => ({
          tab: "private" as const,
          row: existing.row,
          column: header.indexOf(field),
          value,
        })),
      );
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

  /** Restarts the freshness clock: this marker is evidently in use. */
  protected async restartClock(tabs: Tabs, marker: RawRow): Promise<MarkerResult> {
    const stamp = this.stamp();
    const changes = { updated_at: stamp, confirmed_at: stamp };
    await this.writeMarker(tabs, marker, changes);
    return this.result(tabs, { ...marker.cells, ...changes }, true);
  }
}
