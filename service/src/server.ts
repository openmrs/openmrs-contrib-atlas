import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { keycloakVerifier } from "./keycloak.ts";
import { googleSheetStore } from "./sheets.ts";
import { gcsLogoStore, gcsSnapshotStore } from "./storage.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const sheet = googleSheetStore(required("SHEET_ID"));
const bucket = required("BUCKET");
const issuer = process.env.KEYCLOAK_ISSUER;
const clientId = process.env.KEYCLOAK_CLIENT_ID;

const app = createApp({
  sheet,
  snapshots: gcsSnapshotStore(bucket, process.env.STORAGE_ENDPOINT),
  editing:
    issuer && clientId
      ? {
          store: sheet,
          verifyPerson: keycloakVerifier({ issuer, clientId }),
          logos: gcsLogoStore(bucket, process.env.STORAGE_ENDPOINT),
        }
      : undefined,
  auth: {
    publishSecret: required("PUBLISH_SECRET"),
    schedulerEmail: process.env.SCHEDULER_SA_EMAIL ?? "",
    audience: process.env.SERVICE_URL ?? "",
  },
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`atlas service listening on ${port}`));
