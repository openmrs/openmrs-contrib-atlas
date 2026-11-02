/**
 * Who may do what to a marker. See openspec specs/marker-ownership.
 * Usernames are compared in lower case, as Keycloak stores them.
 */

export const ADMIN_GROUP = "atlas-administrators";

export interface Person {
  username: string;
  admin: boolean;
}

export type Role = "admin" | "owner" | "editor";

export type Action =
  | "edit"
  | "confirm"
  | "delete"
  | "contact"
  | "manage-editors"
  | "transfer"
  | "set-owner"
  | "set-status";

const ALLOWED: Record<Role, readonly Action[]> = {
  editor: ["edit", "confirm"],
  owner: ["edit", "confirm", "delete", "contact", "manage-editors", "transfer"],
  admin: [
    "edit",
    "confirm",
    "delete",
    "contact",
    "manage-editors",
    "transfer",
    "set-owner",
    "set-status",
  ],
};

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

/** A person's role on a marker, from its private row; undefined means no rights. */
export function roleOn(
  person: Person,
  row: { owner?: string; editors: string[] } | undefined,
): Role | undefined {
  if (person.admin) return "admin";
  if (!row) return undefined;
  const me = normaliseUsername(person.username);
  if (row.owner && normaliseUsername(row.owner) === me) return "owner";
  return row.editors.some((e) => normaliseUsername(e) === me) ? "editor" : undefined;
}

export function can(role: Role | undefined, action: Action): boolean {
  return role !== undefined && ALLOWED[role].includes(action);
}

/** An OpenMRS ID as entered in a form: no spaces or separators, so it fits the editors cell. */
export function isUsername(value: string): boolean {
  return /^[\p{L}\p{N}._@-]{1,100}$/u.test(value);
}
