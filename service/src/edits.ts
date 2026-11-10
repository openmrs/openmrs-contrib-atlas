import { randomUUID } from "node:crypto";
import {
  COLUMNS,
  CONTACT_FIELDS,
  EDITABLE_FIELDS,
  MARKER_STATUSES,
  TABS,
  can,
  canonicalFields,
  checkLimits,
  checkMarkerRow,
  isPublished,
  isUsername,
  needsConfirming,
  normaliseUsername,
  parseLookups,
  roleOn,
  text,
  toPublicMarker,
  toIsoDate,
  toRawRows,
  validateMarkers,
  type Action,
  type Cell,
  type FieldError,
  type Lookups,
  type Person,
  type PublicMarker,
  type RawRow,
  type Role,
} from "@openmrs-atlas/shared";
import { AccountsUnavailable, type Accounts } from "./accounts.ts";

/** How long a transfer offer stays open. See specs/marker-ownership. */
const OFFER_DAYS = 30;
/** Claim limits. See specs/marker-claims. */
export const MAX_CLAIM_MESSAGE = 1000;
export const MAX_CLAIM_REASON = 500;
export const MAX_PENDING_CLAIMS = 10;
export const ANOTHER_APPROVED = "Another claim for this site was approved.";
export const NOW_OWNED = "This site now has an owner.";
const MS_PER_DAY = 86_400_000;

type Tab = keyof typeof TABS;

export interface EditValues {
  markers: Cell[][];
  private: Cell[][];
  pending: Cell[][];
  claims: Cell[][];
  reminders: Cell[][];
  unsubscribed: Cell[][];
  types: Cell[][];
  distributions: Cell[][];
  versions: Cell[][];
}

export interface CellUpdate {
  tab: Tab;
  /** 1-based sheet row. */
  row: number;
  /** 0-based column. */
  column: number;
  value: Cell;
}

export interface EditStore {
  readEdits(): Promise<EditValues>;
  /** Text is stored literally: a value like "=1+1" must never become a formula. */
  appendRow(tab: Tab, cells: Cell[]): Promise<void>;
  /** Several rows in one call. */
  appendRows(tab: Tab, rows: Cell[][]): Promise<void>;
  updateCells(updates: CellUpdate[]): Promise<void>;
  clearRow(tab: Tab, row: number): Promise<void>;
  readCell(tab: Tab, row: number, column: number): Promise<Cell>;
}

export class ApiError extends Error {
  status: 400 | 403 | 404 | 409 | 410 | 422 | 429 | 503;
  body: { error: string; errors?: FieldError[] };

  constructor(status: ApiError["status"], body: ApiError["body"]) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

const notFound = () => new ApiError(404, { error: "That marker was not found." });
const forbidden = () => new ApiError(403, { error: "You don't have permission to do that." });
const offerGone = () => new ApiError(410, { error: "That offer is no longer open." });
export const accountsUnavailable = () =>
  new ApiError(503, {
    error: "We couldn't check OpenMRS IDs just now. Please try again shortly.",
  });

interface PrivateRow extends RawRow {
  owner: string;
  editors: string[];
}

export interface Claim {
  row: number;
  id: string;
  marker_id: string;
  username: string;
  message: string;
  created_at: string;
  status: string;
}

/** A decision the claimant must be told about, by email after the write. */
export interface ClaimDecision {
  marker_id: string;
  name: string;
  username: string;
  approved: boolean;
  reason: string;
}

interface Offer {
  row: number;
  marker_id: string;
  from: string;
  to: string;
  expires_at: string;
}

/** One fresh read of the sheet, with the row lookups an edit needs. */
class Tabs {
  readonly header: Record<Tab, string[]>;
  readonly markers: RawRow[];
  readonly privates: PrivateRow[];
  readonly offers: Offer[];
  readonly claims: Claim[];
  readonly unsubscribed: { row: number; username: string }[];
  readonly lookups: Lookups;
  readonly values: EditValues;

  constructor(values: EditValues) {
    this.values = values;
    this.header = {
      ...Object.fromEntries(Object.keys(TABS).map((tab) => [tab, []])),
      markers: (values.markers[0] ?? []).map(text),
      private: (values.private[0] ?? []).map(text),
      pending: (values.pending[0] ?? []).map(text),
      claims: (values.claims[0] ?? []).map(text),
    } as unknown as Record<Tab, string[]>;
    this.markers = toRawRows(values.markers, COLUMNS.markers);
    this.privates = toRawRows(values.private, COLUMNS.private).map((raw) => ({
      ...raw,
      owner: text(raw.cells.owner),
      editors: splitEditors(raw.cells.editors),
    }));
    this.offers = toRawRows(values.pending, COLUMNS.pending).map(({ row, cells }) => ({
      row,
      marker_id: text(cells.marker_id),
      from: text(cells.from),
      to: text(cells.to),
      expires_at: text(cells.expires_at),
    }));
    this.claims = toRawRows(values.claims, COLUMNS.claims).map(({ row, cells }) => ({
      row,
      id: text(cells.id),
      marker_id: text(cells.marker_id),
      username: normaliseUsername(text(cells.username)),
      message: text(cells.message),
      created_at: text(cells.created_at),
      status: text(cells.status),
    }));
    this.unsubscribed = toRawRows(values.unsubscribed, COLUMNS.unsubscribed).map(
      ({ row, cells }) => ({ row, username: normaliseUsername(text(cells.username)) }),
    );
    this.lookups = parseLookups(values);
  }

  marker(id: string) {
    return this.markers.find((m) => text(m.cells.id) === id);
  }
  privateOf(id: string) {
    return this.privates.find((p) => text(p.cells.id) === id);
  }
  /** Pending claims, leaving out those on deleted markers. */
  pendingClaims(markerId?: string) {
    return this.claims.filter(
      (c) =>
        c.status === "pending" &&
        (markerId === undefined || c.marker_id === markerId) &&
        text(this.marker(c.marker_id)?.cells.status) !== "deleted",
    );
  }
}

function splitEditors(cell: Cell): string[] {
  return text(cell)
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** What the map needs after a change. `marker` is null if it is no longer on the public map. */
export interface MarkerResult {
  version: string;
  status: string;
  marker: PublicMarker | null;
  /** The public snapshot needs regenerating. */
  publish: boolean;
}

export interface ChangeBody {
  version?: string;
  fields?: Record<string, Cell>;
  contact?: Record<string, Cell>;
  owner?: string;
  editors?: string[];
  status?: string;
}

const NUMERIC = new Set(["latitude", "longitude", "site_count"]);

/** Numbers go into the sheet as numbers; anything unparseable is left for validation to report. */
function cleanFields(fields: Record<string, Cell>): Record<string, Cell> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => {
      if (NUMERIC.has(field) && text(value) !== "" && Number.isFinite(Number(value))) {
        return [field, Number(value)];
      }
      return [field, value ?? ""];
    }),
  );
}

/** Refuses request shapes the form never sends, such as `confirmed_at` or a new `id`. */
export function parseChangeBody(raw: unknown): ChangeBody {
  const bad = () => new ApiError(400, { error: "That request is not valid." });
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw bad();
  const body = raw as Record<string, unknown>;
  const allowed = ["version", "fields", "contact", "owner", "editors", "status"];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw bad();
  const cells = (value: unknown, names: readonly string[]) => {
    if (value === undefined) return undefined;
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw bad();
    for (const [key, cell] of Object.entries(value)) {
      if (!names.includes(key)) throw bad();
      if (cell !== null && typeof cell !== "string" && typeof cell !== "number") throw bad();
    }
    return value as Record<string, Cell>;
  };
  const stringOr = (value: unknown) => {
    if (value !== undefined && typeof value !== "string") throw bad();
    return value as string | undefined;
  };
  if (
    body.editors !== undefined &&
    !(Array.isArray(body.editors) && body.editors.every((e) => typeof e === "string"))
  ) {
    throw bad();
  }
  return {
    version: stringOr(body.version),
    fields: cells(body.fields, EDITABLE_FIELDS),
    contact: cells(body.contact, CONTACT_FIELDS),
    owner: stringOr(body.owner),
    editors: body.editors as string[] | undefined,
    status: stringOr(body.status),
  };
}

/**
 * Every change to a marker. Each method reads the sheet afresh and must run inside the write
 * queue. Permissions are checked here, never in the browser. See specs/marker-editing and
 * specs/marker-ownership.
 */
export class MarkerEditor {
  private store: EditStore;
  private now: () => Date;
  private accounts: Accounts | undefined;

  /** Without `accounts`, OpenMRS IDs are accepted unchecked (specs/account-lookup). */
  constructor(store: EditStore, now: () => Date, accounts?: Accounts) {
    this.store = store;
    this.now = now;
    this.accounts = accounts;
  }

  /** Refuses OpenMRS IDs that don't exist or are disabled, before anything is written. */
  private async requireAccounts(usernames: string[], field: string) {
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

  private async tabs() {
    return new Tabs(await this.store.readEdits());
  }

  private stamp() {
    return this.now().toISOString();
  }

  /** The marker, or 404; deleted markers exist only for admins. */
  private find(tabs: Tabs, person: Person, id: string, action: Action) {
    const marker = tabs.marker(id);
    if (!marker) throw notFound();
    if (text(marker.cells.status) === "deleted" && !person.admin) throw notFound();
    const priv = tabs.privateOf(id);
    const role = roleOn(person, priv);
    if (!can(role, action)) throw forbidden();
    return { marker, priv, role: role! };
  }

  private openOffer(tabs: Tabs, id: string): Offer | undefined {
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
  private async clearOffers(tabs: Tabs, id: string) {
    const now = this.now().getTime();
    for (const offer of tabs.offers) {
      if (offer.marker_id === id || new Date(offer.expires_at).getTime() <= now) {
        await this.store.clearRow("pending", offer.row);
      }
    }
  }

  private async log(person: Person | string, id: string, action: string, fields: unknown[]) {
    await this.store.appendRow("changes", [
      this.stamp(),
      typeof person === "string" ? person : person.username,
      id,
      action,
      JSON.stringify(fields),
    ]);
  }

  /** Writes only the given cells, then checks that the row still holds this marker. */
  private async writeMarker(tabs: Tabs, marker: RawRow, changes: Record<string, Cell>) {
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

  private async writePrivate(tabs: Tabs, id: string, changes: Record<string, Cell>) {
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

  private result(tabs: Tabs, cells: Record<string, Cell>, publish: boolean): MarkerResult {
    const { marker } = checkMarkerRow(cells, tabs.lookups);
    return {
      version: text(cells.updated_at),
      status: text(cells.status),
      marker: marker && isPublished(marker.status) ? toPublicMarker(marker) : null,
      publish,
    };
  }

  /** Restarts the freshness clock: this marker is evidently in use. */
  private async restartClock(tabs: Tabs, marker: RawRow): Promise<MarkerResult> {
    const stamp = this.stamp();
    const changes = { updated_at: stamp, confirmed_at: stamp };
    await this.writeMarker(tabs, marker, changes);
    return this.result(tabs, { ...marker.cells, ...changes }, true);
  }

  /** The signed-in person: their markers and the offers waiting for them. */
  async me(person: Person) {
    const tabs = await this.tabs();
    const { problems } = validateMarkers(tabs.values.markers, tabs.lookups);
    const markers: {
      id: string;
      name: string;
      role: Role;
      status: string;
      confirmed_at: string;
      problems?: string[];
    }[] = [];
    for (const marker of tabs.markers) {
      const id = text(marker.cells.id);
      const status = text(marker.cells.status);
      if (!id || status === "deleted") continue;
      const priv = tabs.privateOf(id);
      const role = roleOn({ ...person, admin: false }, priv);
      if (!role) continue;
      const reasons = problems.find((p) => p.row === marker.row)?.reasons;
      markers.push({
        id,
        name: text(marker.cells.name),
        role,
        status,
        confirmed_at: toIsoDate(marker.cells.confirmed_at) ?? "",
        ...(reasons ? { problems: reasons } : {}),
      });
    }
    const offers = [...new Set(tabs.offers.map((o) => o.marker_id))]
      .map((id) => this.openOffer(tabs, id))
      .filter((o): o is Offer => o !== undefined && normaliseUsername(o.to) === person.username)
      .map((o) => ({
        marker_id: o.marker_id,
        name: text(tabs.marker(o.marker_id)?.cells.name),
        from: o.from,
        expires_at: o.expires_at,
      }));
    return {
      username: person.username,
      admin: person.admin,
      // The person's own email, from their own token: where their reminders go.
      email: person.email ?? "",
      reminders: !tabs.unsubscribed.some((u) => u.username === person.username),
      markers,
      offers,
      claimable: this.claimable(tabs, person),
      claims: tabs
        .pendingClaims()
        .filter((c) => c.username === person.username)
        .map((c) => ({
          id: c.id,
          marker_id: c.marker_id,
          name: text(tabs.marker(c.marker_id)?.cells.name),
          created_at: c.created_at,
        })),
      // Every pending claim, with its message, for admins only (specs/marker-claims).
      ...(person.admin
        ? {
            review: tabs.pendingClaims().map((c) => ({
              id: c.id,
              marker_id: c.marker_id,
              name: text(tabs.marker(c.marker_id)?.cells.name),
              username: c.username,
              message: c.message,
              created_at: c.created_at,
            })),
          }
        : {}),
    };
  }

  /** The form's starting values. Private values only for those entitled to them. */
  async read(person: Person, id: string) {
    const tabs = await this.tabs();
    const { marker, priv, role } = this.find(tabs, person, id, "edit");
    const fields = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, marker.cells[f] ?? ""]));
    const { problems } = validateMarkers(tabs.values.markers, tabs.lookups);
    return {
      id,
      role,
      version: text(marker.cells.updated_at),
      status: text(marker.cells.status),
      fields,
      problems: problems.find((p) => p.row === marker.row)?.reasons ?? [],
      ...(can(role, "contact")
        ? {
            contact: {
              contact_name: text(priv?.cells.contact_name),
              contact_email: text(priv?.cells.contact_email),
            },
            owner: priv?.owner ?? "",
            editors: priv?.editors ?? [],
            offer_to: this.openOffer(tabs, id)?.to,
          }
        : {}),
    };
  }

  async add(person: Person, body: ChangeBody): Promise<{ id: string } & MarkerResult> {
    if ((body.owner !== undefined || body.editors !== undefined) && !person.admin) {
      throw forbidden();
    }
    if (body.status !== undefined || body.version !== undefined) {
      throw new ApiError(400, { error: "That request is not valid." });
    }
    const tabs = await this.tabs();
    const id = randomUUID();
    const stamp = this.stamp();
    const fields = canonicalFields(cleanFields(body.fields ?? {}), tabs.lookups);
    const contact = body.contact ?? {};
    const cells: Record<string, Cell> = {
      ...fields,
      id,
      created_at: stamp,
      updated_at: stamp,
      confirmed_at: stamp,
      status: "active",
    };
    const errors = [
      ...checkLimits({ ...fields, ...contact }, tabs.lookups),
      ...checkMarkerRow(cells, tabs.lookups).errors,
    ];
    if (errors.length > 0) throw new ApiError(422, { error: "Please check the form.", errors });

    const owner = normaliseUsername(body.owner ?? person.username);
    const editors = checkEditors(body.editors ?? []);
    if (!isUsername(owner)) throw invalidUsername("owner");
    if (owner !== person.username) await this.requireAccounts([owner], "owner");
    await this.requireAccounts(editors, "editors");
    await this.store.appendRow(
      "markers",
      tabs.header.markers.map((column) => cells[column] ?? ""),
    );
    await this.writePrivate(tabs, id, { owner, editors: editors.join(","), ...contact });
    await this.log(person, id, "add", [
      ...Object.keys(fields),
      { field: "owner", from: "", to: owner },
    ]);
    return { id, ...this.result(tabs, cells, true) };
  }

  async change(
    person: Person,
    id: string,
    body: ChangeBody,
  ): Promise<MarkerResult & { decisions?: ClaimDecision[] }> {
    const tabs = await this.tabs();
    const { marker, priv, role } = this.find(tabs, person, id, "edit");
    if (body.contact && !can(role, "contact")) throw forbidden();
    if ((body.owner !== undefined || body.editors !== undefined) && !can(role, "set-owner")) {
      throw forbidden();
    }
    if (body.status !== undefined && !can(role, "set-status")) throw forbidden();
    if (body.version !== text(marker.cells.updated_at)) {
      throw new ApiError(409, { error: "This marker has changed since you opened it." });
    }
    if (
      body.status !== undefined &&
      !(MARKER_STATUSES as readonly string[]).includes(body.status)
    ) {
      throw new ApiError(422, {
        error: "Please check the form.",
        errors: [{ field: "status", reason: `unknown status: ${body.status}` }],
      });
    }

    const fields = canonicalFields(cleanFields(body.fields ?? {}), tabs.lookups);
    const changed = Object.fromEntries(
      Object.entries(fields).filter(([f, value]) => text(value) !== text(marker.cells[f])),
    );
    const contact = Object.fromEntries(
      Object.entries(body.contact ?? {}).filter(
        ([f, value]) => text(value) !== text(priv?.cells[f]),
      ),
    );
    const stamp = this.stamp();
    const status = body.status ?? text(marker.cells.status);
    const statusChanged = status !== text(marker.cells.status);
    // Hiding or closing a marker says nothing about whether its details are current.
    const restarts = !statusChanged || status === "active";
    const rowChanges: Record<string, Cell> = {
      ...changed,
      updated_at: stamp,
      ...(restarts ? { confirmed_at: stamp } : {}),
      ...(statusChanged ? { status } : {}),
    };
    const merged = { ...marker.cells, ...rowChanges };
    const errors = [
      ...checkLimits({ ...changed, ...contact }, tabs.lookups),
      ...checkMarkerRow(merged, tabs.lookups).errors,
    ];
    if (errors.length > 0) throw new ApiError(422, { error: "Please check the form.", errors });

    const log: unknown[] = [...Object.keys(changed), ...Object.keys(contact)];
    if (statusChanged) log.push("status");
    const privateChanges: Record<string, Cell> = { ...contact };
    let ownerChanged = false;
    if (body.owner !== undefined) {
      const owner = normaliseUsername(body.owner);
      if (owner && !isUsername(owner)) throw invalidUsername("owner");
      if (owner !== normaliseUsername(priv?.owner ?? "")) {
        if (owner) await this.requireAccounts([owner], "owner");
        privateChanges.owner = owner;
        log.push({ field: "owner", from: priv?.owner ?? "", to: owner });
        ownerChanged = true;
      }
    }
    if (body.editors !== undefined) {
      const added = checkEditors(body.editors);
      const already = new Set((priv?.editors ?? []).map(normaliseUsername));
      await this.requireAccounts(
        added.filter((e) => !already.has(e)),
        "editors",
      );
      const editors = added.join(",");
      const before = (priv?.editors ?? []).join(",");
      if (editors !== before) {
        privateChanges.editors = editors;
        log.push({ field: "editors", from: before, to: editors });
      }
    }
    if (ownerChanged) await this.clearOffers(tabs, id);
    await this.writeMarker(tabs, marker, rowChanges);
    if (Object.keys(privateChanges).length > 0) await this.writePrivate(tabs, id, privateChanges);
    await this.log(person, id, "edit", log);
    // An owner set by an admin answers any pending claims (specs/marker-claims).
    const decisions =
      ownerChanged && privateChanges.owner
        ? await this.declineAll(tabs, person, id, tabs.pendingClaims(id), NOW_OWNED)
        : [];
    return {
      ...this.result(tabs, merged, true),
      ...(decisions.length > 0 ? { decisions } : {}),
    };
  }

  async confirm(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "confirm");
    if (text(marker.cells.status) === "closed") {
      throw new ApiError(409, { error: "This site is closed. Reopen it instead." });
    }
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "confirm", ["confirmed_at"]);
    return result;
  }

  /**
   * A signed-in session started: confirm the person's active markers that were confirmed less
   * than 12 months ago (and more than a day ago, so reloads write nothing). Older markers wait
   * for a deliberate "Still current", so a sign-in for one site can't revive an ended one.
   * Admin rights alone don't make a marker eligible.
   */
  async confirmRecent(person: Person): Promise<{ confirmed: string[]; publish: boolean }> {
    const tabs = await this.tabs();
    const now = this.now();
    const dayAgo = now.getTime() - 86_400_000;
    const due = tabs.markers.filter((marker) => {
      const id = text(marker.cells.id);
      if (!id || text(marker.cells.status) !== "active") return false;
      if (!roleOn({ ...person, admin: false }, tabs.privateOf(id))) return false;
      const confirmed = toIsoDate(marker.cells.confirmed_at);
      if (!confirmed || needsConfirming(confirmed, now)) return false;
      return new Date(confirmed).getTime() < dayAgo;
    });
    if (due.length === 0) return { confirmed: [], publish: false };

    const stamp = this.stamp();
    const header = tabs.header.markers;
    await this.store.updateCells(
      due.flatMap((marker) =>
        (["updated_at", "confirmed_at"] as const).map((field) => ({
          tab: "markers" as const,
          row: marker.row,
          column: header.indexOf(field),
          value: stamp,
        })),
      ),
    );
    const idColumn = header.indexOf("id");
    for (const marker of due) {
      const id = text(marker.cells.id);
      if (text(await this.store.readCell("markers", marker.row, idColumn)) !== id) {
        // A person moved rows in the sheet between the read and the write. Version history recovers.
        console.error(JSON.stringify({ event: "row-moved", marker: id, row: marker.row }));
      }
    }
    const confirmed = due.map((marker) => text(marker.cells.id));
    await this.store.appendRows(
      "changes",
      confirmed.map((id) => [
        stamp,
        person.username,
        id,
        "confirm-on-sign-in",
        JSON.stringify(["confirmed_at"]),
      ]),
    );
    return { confirmed, publish: true };
  }

  /** The implementation has ended. It stays on the map, and says nothing about freshness. */
  async close(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "close");
    if (text(marker.cells.status) !== "active") {
      throw new ApiError(409, { error: "Only an active site can be closed." });
    }
    const changes = { status: "closed", updated_at: this.stamp() };
    await this.writeMarker(tabs, marker, changes);
    await this.log(person, id, "close", ["status"]);
    return this.result(tabs, { ...marker.cells, ...changes }, true);
  }

  async reopen(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "close");
    if (text(marker.cells.status) !== "closed") {
      throw new ApiError(409, { error: "Only a closed site can be reopened." });
    }
    const stamp = this.stamp();
    const changes = { status: "active", updated_at: stamp, confirmed_at: stamp };
    await this.writeMarker(tabs, marker, changes);
    await this.log(person, id, "reopen", ["status", "confirmed_at"]);
    return this.result(tabs, { ...marker.cells, ...changes }, true);
  }

  /** Keeps the row, so an admin can restore the marker by changing its status. */
  async remove(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "delete");
    const changes = { status: "deleted", updated_at: this.stamp() };
    await this.writeMarker(tabs, marker, changes);
    await this.clearOffers(tabs, id);
    await this.log(person, id, "delete", ["status"]);
    return { ...this.result(tabs, { ...marker.cells, ...changes }, true), marker: null };
  }

  async addEditor(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "manage-editors");
    const editor = normaliseUsername(username);
    if (!isUsername(editor)) throw invalidUsername("username");
    const current = priv?.editors ?? [];
    const listed = current.some((e) => normaliseUsername(e) === editor);
    if (listed || editor === normaliseUsername(priv?.owner ?? "")) {
      return { ...this.result(tabs, marker.cells, false), editors: current };
    }
    await this.requireAccounts([editor], "username");
    const editors = [...current, editor];
    return this.saveEditors(person, tabs, marker, id, current, editors);
  }

  async removeEditor(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "manage-editors");
    const current = priv?.editors ?? [];
    const editors = current.filter((e) => normaliseUsername(e) !== normaliseUsername(username));
    if (editors.length === current.length) {
      return { ...this.result(tabs, marker.cells, false), editors: current };
    }
    return this.saveEditors(person, tabs, marker, id, current, editors);
  }

  private async saveEditors(
    person: Person,
    tabs: Tabs,
    marker: RawRow,
    id: string,
    before: string[],
    editors: string[],
  ) {
    await this.writePrivate(tabs, id, { editors: editors.join(",") });
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "edit", [
      { field: "editors", from: before.join(","), to: editors.join(",") },
    ]);
    return { ...result, editors };
  }

  async offer(person: Person, id: string, username: string) {
    const tabs = await this.tabs();
    const { marker, priv } = this.find(tabs, person, id, "transfer");
    const to = normaliseUsername(username);
    if (!isUsername(to)) throw invalidUsername("username");
    if (!priv?.owner) throw new ApiError(409, { error: "This marker has no owner to transfer." });
    if (to === normaliseUsername(priv.owner)) {
      throw new ApiError(422, { error: "That person already owns this marker." });
    }
    await this.requireAccounts([to], "username");
    const now = this.now();
    const expires = new Date(now.getTime() + OFFER_DAYS * MS_PER_DAY).toISOString();
    await this.clearOffers(tabs, id);
    await this.store.appendRow(
      "pending",
      tabs.header.pending.map(
        (column) =>
          (
            ({
              marker_id: id,
              from: priv.owner,
              to,
              created_at: now.toISOString(),
              expires_at: expires,
            }) as Record<string, Cell>
          )[column] ?? "",
      ),
    );
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "transfer-offer", [{ field: "owner", from: priv.owner, to }]);
    return { ...result, offer_to: to };
  }

  async cancelOffer(person: Person, id: string) {
    const tabs = await this.tabs();
    this.find(tabs, person, id, "transfer");
    if (!this.openOffer(tabs, id)) throw offerGone();
    await this.clearOffers(tabs, id);
    await this.log(person, id, "transfer-cancel", []);
  }

  private recipientOffer(tabs: Tabs, person: Person, id: string) {
    const offer = this.openOffer(tabs, id);
    if (!offer) throw offerGone();
    if (normaliseUsername(offer.to) !== person.username) throw forbidden();
    const marker = tabs.marker(id);
    if (!marker || text(marker.cells.status) === "deleted") throw offerGone();
    return { offer, marker };
  }

  async accept(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { offer, marker } = this.recipientOffer(tabs, person, id);
    const priv = tabs.privateOf(id);
    const editors = (priv?.editors ?? []).filter(
      (e) =>
        normaliseUsername(e) !== person.username &&
        normaliseUsername(e) !== normaliseUsername(offer.from),
    );
    // The previous owner stays on as an editor until the new owner removes them.
    editors.push(offer.from);
    await this.writePrivate(tabs, id, { owner: person.username, editors: editors.join(",") });
    await this.clearOffers(tabs, id);
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "transfer", [
      { field: "owner", from: offer.from, to: person.username },
    ]);
    return result;
  }

  /** Turns a person's reminders on or off. Takes a username so emailed links can use it. */
  async setReminders(username: string, on: boolean) {
    const tabs = await this.tabs();
    const who = normaliseUsername(username);
    const rows = tabs.unsubscribed.filter((u) => u.username === who);
    if (on) {
      for (const { row } of rows) await this.store.clearRow("unsubscribed", row);
    } else if (rows.length === 0) {
      await this.store.appendRow("unsubscribed", [who, this.stamp()]);
    }
    return { reminders: on };
  }

  /**
   * "Still current" from an emailed link, already checked for signature and expiry. The link
   * names the `confirmed_at` it was sent for, so it works once and dies as soon as the marker
   * is confirmed any other way. See specs/reminder-emails.
   */
  async confirmFromLink(
    id: string,
    sentFor: string,
    username: string,
  ): Promise<
    | { ok: true; result: MarkerResult }
    | { ok: false; reason: "gone" | "inactive" | "confirmed"; confirmed_at?: string }
  > {
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    if (!marker || text(marker.cells.status) === "deleted") return { ok: false, reason: "gone" };
    const confirmedAt = toIsoDate(marker.cells.confirmed_at) ?? "";
    if (text(marker.cells.status) !== "active") return { ok: false, reason: "inactive" };
    if (confirmedAt !== sentFor) {
      return { ok: false, reason: "confirmed", confirmed_at: confirmedAt };
    }
    const result = await this.restartClock(tabs, marker);
    await this.log(`reminder-link:${normaliseUsername(username)}`, id, "confirm", ["confirmed_at"]);
    return { ok: true, result };
  }

  /** What an emailed link's page shows: public details only. */
  async viewForLink(id: string) {
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    if (!marker || text(marker.cells.status) === "deleted") return undefined;
    return {
      id,
      name: text(marker.cells.name),
      organisation: text(marker.cells.organisation),
      status: text(marker.cells.status),
      confirmed_at: toIsoDate(marker.cells.confirmed_at) ?? "",
    };
  }

  /** Markers this person may claim now: public, no owner, and no claim of theirs waiting. */
  private claimable(tabs: Tabs, person: Person): string[] {
    const mine = new Set(
      tabs
        .pendingClaims()
        .filter((c) => c.username === person.username)
        .map((c) => c.marker_id),
    );
    return tabs.markers
      .filter((m) => {
        const id = text(m.cells.id);
        const status = text(m.cells.status);
        return (
          id !== "" &&
          (status === "active" || status === "closed") &&
          !tabs.privateOf(id)?.owner &&
          !mine.has(id)
        );
      })
      .map((m) => text(m.cells.id));
  }

  /** Asks for ownership of a marker with no owner (specs/marker-claims). */
  async claim(person: Person, id: string, message: unknown) {
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    const status = text(marker?.cells.status);
    if (!marker || (status !== "active" && status !== "closed")) throw notFound();
    if (tabs.privateOf(id)?.owner) {
      throw new ApiError(409, { error: "This site already has an owner." });
    }
    const text_ = typeof message === "string" ? message.trim() : "";
    if (!text_) {
      throw new ApiError(422, {
        error: "Please say how you are connected to this site.",
        errors: [{ field: "message", reason: "Please say how you are connected to this site." }],
      });
    }
    if (text_.length > MAX_CLAIM_MESSAGE) {
      throw new ApiError(422, {
        error: `Please keep the message to ${MAX_CLAIM_MESSAGE.toLocaleString("en")} characters.`,
        errors: [{ field: "message", reason: `At most ${MAX_CLAIM_MESSAGE} characters.` }],
      });
    }
    const mine = tabs.pendingClaims().filter((c) => c.username === person.username);
    if (mine.some((c) => c.marker_id === id)) {
      throw new ApiError(409, { error: "Your claim for this site is already waiting." });
    }
    if (mine.length >= MAX_PENDING_CLAIMS) {
      throw new ApiError(429, {
        error: `You have ${MAX_PENDING_CLAIMS} claims waiting. Please wait for an admin to answer them.`,
      });
    }
    const claim = {
      id: randomUUID(),
      marker_id: id,
      username: person.username,
      message: text_,
      created_at: this.stamp(),
      status: "pending",
    };
    await this.store.appendRow(
      "claims",
      tabs.header.claims.map((column) => (claim as Record<string, Cell>)[column] ?? ""),
    );
    // The message stays in the claims tab; the change log names only the claim.
    await this.log(person, id, "claim", [{ claim: claim.id }]);
    return { claim, name: text(marker.cells.name) };
  }

  private pendingClaim(tabs: Tabs, id: string, claimId: string) {
    const claim = tabs.claims.find((c) => c.id === claimId && c.marker_id === id);
    if (!claim) throw new ApiError(404, { error: "That claim was not found." });
    if (claim.status !== "pending") {
      throw new ApiError(410, { error: "That claim is no longer open." });
    }
    return claim;
  }

  private async decide(tabs: Tabs, claim: Claim, status: string, by: string, reason: string) {
    const header = tabs.header.claims;
    const values: Record<string, Cell> = {
      status,
      decided_by: by,
      decided_at: this.stamp(),
      reason,
    };
    await this.store.updateCells(
      Object.entries(values).map(([field, value]) => ({
        tab: "claims" as const,
        row: claim.row,
        column: header.indexOf(field),
        value,
      })),
    );
  }

  private async declineAll(
    tabs: Tabs,
    person: Person,
    id: string,
    claims: Claim[],
    reason: string,
  ): Promise<ClaimDecision[]> {
    const name = text(tabs.marker(id)?.cells.name);
    for (const claim of claims) {
      await this.decide(tabs, claim, "declined", person.username, reason);
      await this.log(person, id, "claim-decline", [{ claim: claim.id }]);
    }
    return claims.map((c) => ({
      marker_id: id,
      name,
      username: c.username,
      approved: false,
      reason,
    }));
  }

  async withdrawClaim(person: Person, id: string, claimId: string) {
    const tabs = await this.tabs();
    const claim = this.pendingClaim(tabs, id, claimId);
    if (claim.username !== person.username) throw forbidden();
    await this.decide(tabs, claim, "withdrawn", person.username, "");
    await this.log(person, id, "claim-withdraw", [{ claim: claim.id }]);
  }

  /** Makes the claimant the owner and answers every other claim on the marker. */
  async approveClaim(
    person: Person,
    id: string,
    claimId: string,
  ): Promise<MarkerResult & { decisions: ClaimDecision[] }> {
    if (!person.admin) throw forbidden();
    const tabs = await this.tabs();
    const marker = tabs.marker(id);
    if (!marker) throw notFound();
    const claim = this.pendingClaim(tabs, id, claimId);
    const priv = tabs.privateOf(id);
    if (priv?.owner) throw new ApiError(409, { error: "This site already has an owner." });
    const editors = (priv?.editors ?? []).filter((e) => normaliseUsername(e) !== claim.username);
    await this.writePrivate(tabs, id, { owner: claim.username, editors: editors.join(",") });
    await this.clearOffers(tabs, id);
    const result = await this.restartClock(tabs, marker);
    await this.decide(tabs, claim, "approved", person.username, "");
    await this.log(person, id, "claim-approve", [
      { claim: claim.id },
      { field: "owner", from: "", to: claim.username },
    ]);
    const others = tabs.pendingClaims(id).filter((c) => c.id !== claim.id);
    const declined = await this.declineAll(tabs, person, id, others, ANOTHER_APPROVED);
    const name = text(marker.cells.name);
    return {
      ...result,
      decisions: [
        { marker_id: id, name, username: claim.username, approved: true, reason: "" },
        ...declined,
      ],
    };
  }

  async declineClaim(
    person: Person,
    id: string,
    claimId: string,
    reason: unknown,
  ): Promise<ClaimDecision> {
    if (!person.admin) throw forbidden();
    if (reason !== undefined && typeof reason !== "string") {
      throw new ApiError(400, { error: "That request is not valid." });
    }
    const why = (reason ?? "").trim();
    if (why.length > MAX_CLAIM_REASON) {
      throw new ApiError(422, {
        error: `Please keep the reason to ${MAX_CLAIM_REASON} characters.`,
        errors: [{ field: "reason", reason: `At most ${MAX_CLAIM_REASON} characters.` }],
      });
    }
    const tabs = await this.tabs();
    if (!tabs.marker(id)) throw notFound();
    const claim = this.pendingClaim(tabs, id, claimId);
    const [decision] = await this.declineAll(tabs, person, id, [claim], why);
    return decision!;
  }

  async decline(person: Person, id: string) {
    const tabs = await this.tabs();
    this.recipientOffer(tabs, person, id);
    await this.clearOffers(tabs, id);
    await this.log(person, id, "transfer-decline", []);
  }
}

function invalidUsername(field: string) {
  return new ApiError(422, {
    error: "Please check the OpenMRS ID.",
    errors: [{ field, reason: "That doesn't look like an OpenMRS ID." }],
  });
}

function checkEditors(editors: string[]): string[] {
  const clean = [...new Set(editors.map(normaliseUsername).filter(Boolean))];
  if (!clean.every(isUsername)) throw invalidUsername("editors");
  return clean;
}
