import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { keycloakAccounts } from "./accounts.ts";
import { keycloakVerifier } from "./keycloak.ts";
import { linkSigner } from "./links.ts";
import { mandrillMailer, parseAllowlist } from "./mailer.ts";
import { googleSheetStore } from "./sheets.ts";
import { gcsLogoStore, gcsSnapshotStore } from "./storage.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Secrets pasted into Secret Manager often end with a newline. */
const secret = (name: string) => process.env[name]?.trim() || undefined;

const sheetId = required("SHEET_ID");
const sheet = googleSheetStore(sheetId);
const bucket = required("BUCKET");
const siteUrl = required("SITE_URL");
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
  allowlist: parseAllowlist(process.env.EMAIL_ALLOWLIST),
});

const app = createApp({
  sheet,
  siteUrl,
  snapshots: gcsSnapshotStore(bucket, process.env.STORAGE_ENDPOINT),
  editing:
    issuer && clientId
      ? {
          store: sheet,
          verifyPerson: keycloakVerifier({ issuer, clientId }),
          logos: gcsLogoStore(bucket, process.env.STORAGE_ENDPOINT),
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
  auth: {
    publishSecret: required("PUBLISH_SECRET"),
    schedulerEmail: process.env.SCHEDULER_SA_EMAIL ?? "",
    audience: process.env.SERVICE_URL ?? "",
  },
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`atlas service listening on ${port}`));
