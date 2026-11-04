/**
 * Before reminders start: how many markers are due, and which owners and editors can't be
 * reached. Prints counts and usernames only, never emails. Reads the sheet and looks up each
 * owner and editor through the read-only `atlas-service` Keycloak client. Changes nothing.
 *
 *   KEYCLOAK_ISSUER=https://id-stg.openmrs.org/realms/openmrs \
 *   KEYCLOAK_SERVICE_CLIENT_SECRET="$(gcloud secrets versions access latest \
 *     --secret=atlas-keycloak-service-secret)" \
 *   npm run report:accounts -w service -- <sheet id>
 *
 * Credentials for the sheet: Application Default Credentials, as for setup:sheet.
 */
import {
  COLUMNS,
  normaliseUsername,
  parseLookups,
  text,
  toRawRows,
  validateMarkers,
} from "@openmrs-atlas/shared";
import { keycloakAccounts } from "../accounts.ts";
import { selectDue, stageFor } from "../reminders.ts";
import { googleSheetStore } from "../sheets.ts";

const [sheetId] = process.argv.slice(2);
const issuer = process.env.KEYCLOAK_ISSUER;
const clientSecret = process.env.KEYCLOAK_SERVICE_CLIENT_SECRET?.trim();
if (!sheetId || !issuer || !clientSecret) {
  console.error(
    "usage: KEYCLOAK_ISSUER=... KEYCLOAK_SERVICE_CLIENT_SECRET=... npm run report:accounts -w service -- <sheet id>",
  );
  process.exit(1);
}

async function main() {
  const now = new Date();
  const sheet = await googleSheetStore(sheetId!).readEdits();
  const { markers } = validateMarkers(sheet.markers, parseLookups(sheet));
  const active = markers.filter((m) => m.status === "active");

  const byStage = { none: 0, 12: 0, 18: 0, 24: 0 };
  for (const m of active)
    byStage[m.confirmed_at ? (stageFor(m.confirmed_at, now) ?? "none") : "none"]++;

  const people = new Map<string, number>();
  let orphans = 0;
  const activeIds = new Set(active.map((m) => m.id));
  for (const { cells } of toRawRows(sheet.private, COLUMNS.private)) {
    if (!activeIds.has(text(cells.id))) continue;
    const names = [text(cells.owner), ...text(cells.editors).split(",")]
      .map(normaliseUsername)
      .filter(Boolean);
    if (names.length === 0) orphans++;
    for (const name of new Set(names)) people.set(name, (people.get(name) ?? 0) + 1);
  }
  orphans += active.filter(
    (m) => !toRawRows(sheet.private, COLUMNS.private).some((r) => text(r.cells.id) === m.id),
  ).length;

  const accounts = keycloakAccounts({
    issuer: issuer!,
    clientId: "atlas-service",
    clientSecret: clientSecret!,
  });
  const missing: string[] = [];
  const disabled: string[] = [];
  const noEmail: string[] = [];
  for (const username of [...people.keys()].sort()) {
    const account = await accounts.lookup(username);
    if (!account) missing.push(username);
    else if (!account.enabled) disabled.push(username);
    else if (!account.email) noEmail.push(username);
  }

  const due = selectDue(sheet, now);
  const list = (names: string[]) => (names.length ? `\n    ${names.join(", ")}` : "");
  console.log(
    [
      `Active markers: ${active.length}`,
      `  confirmed within 12 months: ${byStage.none}`,
      `  past 12 months: ${byStage[12]}, past 18: ${byStage[18]}, past 24: ${byStage[24]}`,
      `  with no owner or editors: ${orphans}`,
      `People listed as owner or editor of an active marker: ${people.size}`,
      `  no such OpenMRS ID: ${missing.length}${list(missing)}`,
      `  account disabled: ${disabled.length}${list(disabled)}`,
      `  account has no email: ${noEmail.length}${list(noEmail)}`,
      `First reminder run: ${due.people.length} people due, ${due.skipped.length} rows skipped up front`,
      `  at 50 a day, the backlog takes ${Math.ceil(due.people.length / 50)} days`,
    ].join("\n"),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
