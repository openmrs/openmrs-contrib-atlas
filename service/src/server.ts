import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { keycloakAccounts } from "./accounts.ts";
import { keycloakVerifier } from "./keycloak.ts";
import { linkSigner } from "./links.ts";
import { emailAllowlist, mandrillMailer } from "./mailer.ts";
import { googleSheetStore } from "./sheets.ts";
import { jobsOff, startScheduler } from "./scheduler.ts";
import { folderStores } from "./storage.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Secrets pasted into settings often end with a newline. */
const secret = (name: string) => process.env[name]?.trim() || undefined;

/** Built into the image: `staging` or `production` (specs/deployment). */
const environment = process.env.ATLAS_ENVIRONMENT || undefined;
const commit = process.env.ATLAS_COMMIT || undefined;

const sheetId = required("SHEET_ID");
const sheet = googleSheetStore(sheetId);
const siteUrl = required("SITE_URL");
/** Published files, cards and logos: a volume in production (specs/deployment). */
const dataDir = process.env.DATA_DIR || "/atlas_data";
const files = folderStores(dataDir, siteUrl);
const issuer = process.env.KEYCLOAK_ISSUER;
const clientId = process.env.KEYCLOAK_CLIENT_ID;
const serviceClientId = process.env.KEYCLOAK_SERVICE_CLIENT_ID;
const serviceClientSecret = secret("KEYCLOAK_SERVICE_CLIENT_SECRET");
const linkKey = secret("LINK_SIGNING_KEY");

const accounts =
  issuer && serviceClientId && serviceClientSecret
    ? keycloakAccounts({ issuer, clientId: serviceClientId, clientSecret: serviceClientSecret })
    : undefined;
if (!accounts) console.log(JSON.stringify({ event: "accounts-off" }));

const mailer = mandrillMailer({
  apiKey: secret("MANDRILL_API_KEY"),
  from: process.env.EMAIL_FROM ?? "OpenMRS Atlas <atlas-noreply@openmrs.org>",
  allowlist: emailAllowlist(process.env.EMAIL_ALLOWLIST, environment),
});

const app = createApp({
  sheet,
  siteUrl,
  snapshots: files.snapshots,
  cards: files.cards,
  editing:
    issuer && clientId
      ? {
          store: sheet,
          verifyPerson: keycloakVerifier({ issuer, clientId }),
          logos: files.logos,
        }
      : undefined,
  accounts,
  reminders: linkKey ? { mailer, signer: linkSigner(linkKey) } : undefined,
  notices: {
    mailer,
    to: process.env.NOTICE_EMAIL || undefined,
    siteUrl,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
  },
  site: {
    webDir: process.env.WEB_DIR || new URL("../../web/dist", import.meta.url).pathname,
    dataDir,
    keycloakIssuer: issuer,
  },
  about: { environment, commit },
  auth: { publishSecret: required("PUBLISH_SECRET") },
});

// The nightly publish and the daily reminders (specs/deployment). Off for local development.
if (jobsOff(process.env.SCHEDULED_JOBS)) {
  console.log(JSON.stringify({ event: "jobs-off" }));
} else {
  startScheduler([
    { name: "nightly-publish", hourUtc: 3, run: app.jobs.nightlyPublish },
    { name: "reminders", hourUtc: 14, run: app.jobs.reminders },
  ]);
}

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`atlas service listening on ${port}`));
