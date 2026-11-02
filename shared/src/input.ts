import { COLUMNS, type Cell, type Lookups, type Marker } from "./schema.ts";
import { validateMarkers } from "./validate.ts";

/**
 * Marker fields changed through the Atlas. See openspec specs/marker-editing.
 * Other columns (id, dates, status) are set by the service, never by the form.
 */
export const EDITABLE_FIELDS = [
  "name",
  "organisation",
  "latitude",
  "longitude",
  "type",
  "distribution",
  "openmrs_version",
  "site_count",
  "url",
  "logo_url",
  "notes",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

export const CONTACT_FIELDS = ["contact_name", "contact_email"] as const;
export type ContactField = (typeof CONTACT_FIELDS)[number];

const MAX_LENGTH: Record<string, number> = {
  name: 200,
  organisation: 200,
  url: 2000,
  logo_url: 2000,
  notes: 2000,
  contact_name: 200,
  contact_email: 320,
};

export interface FieldError {
  field: string;
  reason: string;
}

/** Length and format limits, applied only to values a person is changing. */
export function checkLimits(changed: Record<string, Cell>): FieldError[] {
  const errors: FieldError[] = [];
  for (const [field, value] of Object.entries(changed)) {
    const limit = MAX_LENGTH[field];
    if (limit !== undefined && String(value ?? "").length > limit) {
      errors.push({ field, reason: `${field} must be ${limit} characters or fewer` });
    }
  }
  const email = String(changed.contact_email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: "contact_email", reason: "contact_email must be an email address" });
  }
  return errors;
}

/** The marker rules for one whole row, with each reason tied to the field it is about. */
export function checkMarkerRow(
  cells: Record<string, Cell>,
  lookups: Lookups,
): { marker?: Marker; errors: FieldError[] } {
  const row = COLUMNS.markers.map((c) => cells[c] ?? "");
  const { markers, problems } = validateMarkers([[...COLUMNS.markers], row], lookups);
  const errors = (problems[0]?.reasons ?? []).map((reason) => ({
    field: fieldOf(reason),
    reason,
  }));
  return { marker: markers[0], errors };
}

function fieldOf(reason: string): string {
  const unknown = /^unknown (\w+):/.exec(reason);
  return unknown ? unknown[1]! : (reason.split(" ")[0] ?? "");
}
