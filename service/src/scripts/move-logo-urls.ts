/**
 * Rewrites every `logo_url` in a sheet that starts with one address to start with another, for
 * when logos move (service/README.md, "Moving logo addresses"). Previews unless given --apply.
 * Prints marker ids and counts only.
 *
 *   npm run move:logos -w service -- <sheet id> \
 *     --from https://storage.googleapis.com/openmrs-atlas-stg/logos/ \
 *     --to https://atlas-stg.openmrs.org/data/logos/ [--apply]
 *
 * Credentials for the sheet: GOOGLE_SERVICE_ACCOUNT_KEY, or Application Default Credentials.
 */
import { parseArgs } from "node:util";
import { moveLogoUrls } from "../logo-move.ts";
import { googleSheetStore } from "../sheets.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: "string" },
    to: { type: "string" },
    apply: { type: "boolean", default: false },
  },
});
const [sheetId] = positionals;
if (!sheetId || !values.from || !values.to) {
  console.error(
    "usage: npm run move:logos -w service -- <sheet id> --from <address>/ --to <address>/ [--apply]",
  );
  process.exit(1);
}

const { moves, applied } = await moveLogoUrls(googleSheetStore(sheetId), {
  from: values.from,
  to: values.to,
  apply: values.apply,
});
for (const move of moves) console.log(`row ${move.row}  ${move.id}`);
if (moves.length === 0) console.log("No logo_url starts with that address. Nothing to do.");
else if (applied) console.log(`Moved ${moves.length} logo addresses. Publish to show them.`);
else
  console.log(`Would move ${moves.length} logo addresses. Run again with --apply to write them.`);
