import type { PublicMarker } from "@openmrs-atlas/shared";
import { NO_REPLY_HTML, NO_REPLY_TEXT } from "./help.ts";
import type { Mailer } from "./mailer.ts";

/**
 * The notice sent to one optional address when a marker is added in the Atlas.
 * See specs/entry-notices. Sending never blocks or fails the add.
 */

export interface NoticeConfig {
  mailer: Mailer;
  /** Unset: no notices. */
  to?: string;
  siteUrl: string;
  sheetUrl: string;
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderNotice(
  marker: PublicMarker,
  addedBy: string,
  config: Omit<NoticeConfig, "mailer" | "to">,
) {
  const site = config.siteUrl.replace(/\/+$/, "");
  const markerUrl = `${site}/?marker=${encodeURIComponent(marker.id)}`;
  const facts = [
    ["Type", marker.type],
    ["Country", marker.country ?? "Unknown"],
    ["Added by", addedBy],
  ] as const;
  const subject = `New on the OpenMRS Atlas: ${marker.name}`;
  const text = [
    `${addedBy} added ${marker.name} to the OpenMRS Atlas.`,
    "",
    ...facts.map(([label, value]) => `${label}: ${value}`),
    "",
    `On the map: ${markerUrl}`,
    `In the sheet: ${config.sheetUrl}`,
    "",
    NO_REPLY_TEXT,
    "",
  ].join("\n");
  const a = (href: string, label: string) => `<a href="${escape(href)}">${escape(label)}</a>`;
  const html = [
    '<!doctype html><html><body style="font-family: sans-serif; line-height: 1.5">',
    `<p>${escape(addedBy)} added <strong>${escape(marker.name)}</strong> to the OpenMRS Atlas.</p>`,
    `<p>${facts.map(([label, value]) => `${label}: ${escape(value)}`).join("<br>")}</p>`,
    `<p>${a(markerUrl, "See it on the map")} · ${a(config.sheetUrl, "Open the sheet")}</p>`,
    `<p>${NO_REPLY_HTML}</p>`,
    "</body></html>",
  ].join("\n");
  return { subject, text, html };
}

/** Sends the notice; logs and swallows any failure. */
export async function sendNotice(
  config: NoticeConfig,
  marker: PublicMarker,
  addedBy: string,
): Promise<void> {
  if (!config.to) return;
  try {
    await config.mailer.send({
      to: config.to,
      ...renderNotice(marker, addedBy, config),
      kind: "notice",
      markers: [marker.id],
    });
  } catch (err) {
    console.error(JSON.stringify({ event: "notice-failed", message: (err as Error).message }));
  }
}
