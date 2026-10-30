import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { googleSheetStore } from "./sheets.ts";
import { gcsSnapshotStore } from "./storage.ts";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const app = createApp({
  sheet: googleSheetStore(required("SHEET_ID")),
  snapshots: gcsSnapshotStore(required("BUCKET"), process.env.STORAGE_ENDPOINT),
  auth: {
    publishSecret: required("PUBLISH_SECRET"),
    schedulerEmail: process.env.SCHEDULER_SA_EMAIL ?? "",
    audience: process.env.SERVICE_URL ?? "",
  },
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`atlas service listening on ${port}`));
