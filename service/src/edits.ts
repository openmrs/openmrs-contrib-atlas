import { randomUUID } from "node:crypto";
import {
  COLUMNS,
  CONTACT_FIELDS,
  EDITABLE_FIELDS,
  MARKER_STATUSES,
  TABS,
  can,
  checkLimits,
  checkMarkerRow,
  isUsername,
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

/** How long a transfer offer stays open. See specs/marker-ownership. */
const OFFER_DAYS = 30;
const MS_PER_DAY = 86_400_000;

type Tab = keyof typeof TABS;

export interface EditValues {
  markers: Cell[][];
  private: Cell[][];
  pending: Cell[][];
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
  updateCells(updates: CellUpdate[]): Promise<void>;
  clearRow(tab: Tab, row: number): Promise<void>;
  readCell(tab: Tab, row: number, column: number): Promise<Cell>;
}

export class ApiError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 410 | 422,
    public body: { error: string; errors?: FieldError[] },
  ) {
    super(body.error);
  }
}

const notFound = () => new ApiError(404, { error: "That marker was not found." });
const forbidden = () => new ApiError(403, { error: "You don't have permission to do that." });
const offerGone = () => new ApiError(410, { error: "That offer is no longer open." });

interface PrivateRow extends RawRow {
  owner: string;
  editors: string[];
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
  readonly lookups: Lookups;

  constructor(readonly values: EditValues) {
    this.header = {
      ...Object.fromEntries(Object.keys(TABS).map((tab) => [tab, []])),
      markers: (values.markers[0] ?? []).map(text),
      private: (values.private[0] ?? []).map(text),
      pending: (values.pending[0] ?? []).map(text),
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
    this.lookups = parseLookups(values);
  }

  marker(id: string) {
    return this.markers.find((m) => text(m.cells.id) === id);
  }
  privateOf(id: string) {
    return this.privates.find((p) => text(p.cells.id) === id);
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
  constructor(
    private store: EditStore,
    private now: () => Date,
  ) {}

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

  private async log(person: Person, id: string, action: string, fields: unknown[]) {
    await this.store.appendRow("changes", [
      this.stamp(),
      person.username,
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
      marker: marker && marker.status === "active" ? toPublicMarker(marker) : null,
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
    return { username: person.username, admin: person.admin, markers, offers };
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
    const fields = cleanFields(body.fields ?? {});
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
      ...checkLimits({ ...fields, ...contact }),
      ...checkMarkerRow(cells, tabs.lookups).errors,
    ];
    if (errors.length > 0) throw new ApiError(422, { error: "Please check the form.", errors });

    const owner = normaliseUsername(body.owner ?? person.username);
    const editors = checkEditors(body.editors ?? []);
    if (!isUsername(owner)) throw invalidUsername("owner");
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

  async change(person: Person, id: string, body: ChangeBody): Promise<MarkerResult> {
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

    const fields = cleanFields(body.fields ?? {});
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
      ...checkLimits({ ...changed, ...contact }),
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
        privateChanges.owner = owner;
        log.push({ field: "owner", from: priv?.owner ?? "", to: owner });
        ownerChanged = true;
      }
    }
    if (body.editors !== undefined) {
      const editors = checkEditors(body.editors).join(",");
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
    return this.result(tabs, merged, true);
  }

  async confirm(person: Person, id: string): Promise<MarkerResult> {
    const tabs = await this.tabs();
    const { marker } = this.find(tabs, person, id, "confirm");
    const result = await this.restartClock(tabs, marker);
    await this.log(person, id, "confirm", ["confirmed_at"]);
    return result;
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
