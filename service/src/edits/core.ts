/**
 * What every part of marker editing shares: the sheet's shape, errors, one fresh read of the
 * tabs, and request parsing. See specs/marker-editing.
 */
import {
  COLUMNS,
  CONTACT_FIELDS,
  EDITABLE_FIELDS,
  TABS,
  isUsername,
  normaliseUsername,
  parseLookups,
  text,
  toRawRows,
  type Cell,
  type FieldError,
  type Lookups,
  type Person,
  type PublicMarker,
  type RawRow,
} from "@openmrs-atlas/shared";

/** How long a transfer offer stays open. See specs/marker-ownership. */
export const OFFER_DAYS = 30;
/** Claim limits. See specs/marker-claims. */
export const MAX_CLAIM_MESSAGE = 1000;
export const MAX_CLAIM_REASON = 500;
export const MAX_PENDING_CLAIMS = 10;
export const ANOTHER_APPROVED = "Another claim for this site was approved.";
export const NOW_OWNED = "This site now has an owner.";
export const MS_PER_DAY = 86_400_000;

export type Tab = keyof typeof TABS;

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
  /** One column of a tab, header row first, in a single read. */
  readColumn(tab: Tab, column: number): Promise<Cell[]>;
}

export class ApiError extends Error {
  status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 503;
  body: { error: string; errors?: FieldError[]; code?: string };

  constructor(status: ApiError["status"], body: ApiError["body"]) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

export const notFound = () => new ApiError(404, { error: "That marker was not found." });
export const forbidden = () =>
  new ApiError(403, { error: "You don't have permission to do that." });
export const offerGone = () => new ApiError(410, { error: "That offer is no longer open." });
/** How recently a person must have entered their password for a weighty action. */
export const RECENT_SIGN_IN_MS = 10 * 60_000;

/**
 * Offering a marker to a new owner, and anything only admin rights allow, need a sign-in within
 * the last 10 minutes, however long the session has run (specs/user-sign-in, "Weighty actions
 * need a recent sign-in"). A token without a sign-in time is never recent.
 */
export function requireRecentSignIn(person: Person, now: Date): void {
  const at = person.signedInAt;
  if (at !== undefined && now.getTime() - at <= RECENT_SIGN_IN_MS) return;
  throw new ApiError(401, { error: "Please sign in again to do this.", code: "sign-in-again" });
}

export const accountsUnavailable = () =>
  new ApiError(503, {
    error: "We couldn't check OpenMRS IDs just now. Please try again shortly.",
  });

export interface PrivateRow extends RawRow {
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

export interface Offer {
  row: number;
  marker_id: string;
  from: string;
  to: string;
  expires_at: string;
}

/** One fresh read of the sheet, with the row lookups an edit needs. */
export class Tabs {
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
    this.markers = toRawRows(values.markers, COLUMNS.markers, "markers");
    this.privates = toRawRows(values.private, COLUMNS.private, "private").map((raw) => ({
      ...raw,
      owner: text(raw.cells.owner),
      editors: splitEditors(raw.cells.editors),
    }));
    this.offers = toRawRows(values.pending, COLUMNS.pending, "pending").map(({ row, cells }) => ({
      row,
      marker_id: text(cells.marker_id),
      from: text(cells.from),
      to: text(cells.to),
      expires_at: text(cells.expires_at),
    }));
    this.claims = toRawRows(values.claims, COLUMNS.claims, "claims").map(({ row, cells }) => ({
      row,
      id: text(cells.id),
      marker_id: text(cells.marker_id),
      username: normaliseUsername(text(cells.username)),
      message: text(cells.message),
      created_at: text(cells.created_at),
      status: text(cells.status),
    }));
    this.unsubscribed = toRawRows(values.unsubscribed, COLUMNS.unsubscribed, "unsubscribed").map(
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
export function cleanFields(fields: Record<string, Cell>): Record<string, Cell> {
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

export function invalidUsername(field: string) {
  return new ApiError(422, {
    error: "Please check the OpenMRS ID.",
    errors: [{ field, reason: "That doesn't look like an OpenMRS ID." }],
  });
}

export function checkEditors(editors: string[]): string[] {
  const clean = [...new Set(editors.map(normaliseUsername).filter(Boolean))];
  if (!clean.every(isUsername)) throw invalidUsername("editors");
  return clean;
}
