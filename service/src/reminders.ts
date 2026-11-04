import {
  COLUMNS,
  normaliseUsername,
  parseLookups,
  text,
  toIsoDate,
  toPublicMarker,
  toRawRows,
  validateMarkers,
  type Cell,
  type PublicMarker,
} from "@openmrs-atlas/shared";
import { AccountsUnavailable, type Accounts } from "./accounts.ts";
import type { EditStore } from "./edits.ts";
import type { LinkSigner } from "./links.ts";
import { NO_REPLY_HTML, NO_REPLY_TEXT } from "./help.ts";
import type { Mailer } from "./mailer.ts";

/**
 * Reminder emails. See specs/reminder-emails and design.md, "A daily job, idempotent through
 * the reminders tab". Emails are looked up per run and never stored: the reminders tab holds
 * usernames and outcomes only.
 */

/** Months since `confirmed_at`, latest first. */
export const STAGES = [24, 18, 12] as const;
export type Stage = (typeof STAGES)[number];
export const DAILY_LIMIT = 50;

export interface DueMarker {
  marker: PublicMarker;
  /** `confirmed_at` as an ISO string, exactly as links and the reminders tab record it. */
  confirmedAt: string;
  stage: Stage;
}

export interface ReminderRow {
  marker_id: string;
  stage: Stage;
  confirmed_at: string;
  username: string;
  sent_at: string;
  result: string;
}

export interface Selection {
  /** People to email, oldest due marker first, each with every marker of theirs that is due. */
  people: { username: string; markers: DueMarker[] }[];
  /** Outcomes known without sending: orphans and unsubscribed people. */
  skipped: ReminderRow[];
  /** Emails already sent today, which count against the daily limit. */
  sentToday: number;
}

/** `iso` plus whole calendar months, in UTC. */
export function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  const out = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + months,
      1,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  );
  // Keep the day of the month, or the month's last day if it is shorter (31 Jan + 1 = 28 Feb).
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return out;
}

/** The latest stage `confirmedAt` has passed, if any. */
export function stageFor(confirmedAt: string, now: Date): Stage | undefined {
  return STAGES.find((months) => addMonths(confirmedAt, months).getTime() <= now.getTime());
}

const key = (id: string, stage: Stage | number, confirmedAt: string, username: string) =>
  `${id}|${stage}|${confirmedAt}|${username}`;

export interface ReminderSheet {
  markers: Cell[][];
  private: Cell[][];
  reminders: Cell[][];
  unsubscribed: Cell[][];
  types: Cell[][];
  distributions: Cell[][];
  versions: Cell[][];
}

/** Who is due what today. Pure, so the rules can be tested without a sheet or Keycloak. */
export function selectDue(sheet: ReminderSheet, now: Date): Selection {
  const lookups = parseLookups(sheet);
  // Only valid markers: an invalid one isn't on the map, so its links would lead nowhere.
  const { markers } = validateMarkers(sheet.markers, lookups);
  const people = new Map<string, string[]>();
  for (const { cells } of toRawRows(sheet.private, COLUMNS.private)) {
    const names = [text(cells.owner), ...text(cells.editors).split(",")]
      .map(normaliseUsername)
      .filter(Boolean);
    people.set(text(cells.id), [...new Set(names)]);
  }
  const unsubscribed = new Set(
    toRawRows(sheet.unsubscribed, COLUMNS.unsubscribed).map((r) =>
      normaliseUsername(text(r.cells.username)),
    ),
  );
  const recorded = new Set<string>();
  const today = now.toISOString().slice(0, 10);
  const sentEmails = new Set<string>();
  for (const { cells } of toRawRows(sheet.reminders, COLUMNS.reminders)) {
    const confirmedAt = toIsoDate(cells.confirmed_at) ?? text(cells.confirmed_at);
    const username = normaliseUsername(text(cells.username));
    recorded.add(key(text(cells.marker_id), Number(cells.stage), confirmedAt, username));
    const sentAt = toIsoDate(cells.sent_at) ?? text(cells.sent_at);
    if (text(cells.result) === "sent" && sentAt.startsWith(today)) {
      // One email covers several rows; they share a username and a sent_at.
      sentEmails.add(`${username}|${sentAt}`);
    }
  }

  const stamp = now.toISOString();
  const skipped: ReminderRow[] = [];
  const byPerson = new Map<string, DueMarker[]>();
  for (const marker of markers) {
    if (marker.status !== "active" || !marker.confirmed_at) continue;
    const confirmedAt = marker.confirmed_at;
    const stage = stageFor(confirmedAt, now);
    if (!stage) continue;
    const due: DueMarker = { marker: toPublicMarker(marker), confirmedAt, stage };
    const row = (username: string, result: string): ReminderRow => ({
      marker_id: marker.id,
      stage,
      confirmed_at: confirmedAt,
      username,
      sent_at: stamp,
      result,
    });
    const names = people.get(marker.id) ?? [];
    if (names.length === 0) {
      if (!recorded.has(key(marker.id, stage, confirmedAt, ""))) skipped.push(row("", "no owner"));
      continue;
    }
    for (const username of names) {
      if (recorded.has(key(marker.id, stage, confirmedAt, username))) continue;
      if (unsubscribed.has(username)) {
        skipped.push(row(username, "unsubscribed"));
        continue;
      }
      byPerson.set(username, [...(byPerson.get(username) ?? []), due]);
    }
  }

  const oldest = (ms: DueMarker[]) => Math.min(...ms.map((m) => new Date(m.confirmedAt).getTime()));
  const ordered = [...byPerson.entries()]
    .map(([username, ms]) => ({
      username,
      markers: ms.sort(
        (a, b) => new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime(),
      ),
    }))
    .sort((a, b) => oldest(a.markers) - oldest(b.markers) || a.username.localeCompare(b.username));
  return { people: ordered, skipped, sentToday: sentEmails.size };
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export interface ReminderEmailInput {
  username: string;
  name: string;
  markers: DueMarker[];
  siteUrl: string;
  confirmLink: (due: DueMarker) => string;
  unsubscribeLink: string;
}

/** The reminder for one person: plain text, and simple HTML with no images. */
export function renderReminder(input: ReminderEmailInput) {
  const site = input.siteUrl.replace(/\/+$/, "");
  const many = input.markers.length > 1;
  const first = input.markers[0]!.marker.name;
  const subject = many
    ? `Are your ${input.markers.length} OpenMRS Atlas entries still current?`
    : `Is ${first} still current on the OpenMRS Atlas?`;
  const greeting = `Hello ${input.name || input.username},`;
  const why = `You're receiving this because your OpenMRS ID (${input.username}) is listed as an owner or editor of ${many ? "these entries" : "this entry"} on the OpenMRS Atlas, and ${many ? "they haven't" : "it hasn't"} been confirmed for a while.`;
  const fade =
    'Entries fade on the map until someone confirms them, so a quick confirmation keeps your site visible to the community. "Still current" works without signing in, once, for 30 days.';

  const entries = input.markers.map((due) => {
    const m = due.marker;
    const markerUrl = `${site}/?marker=${encodeURIComponent(m.id)}`;
    const details = [m.organisation, m.type, m.country].filter(Boolean).join(" · ");
    return {
      name: m.name,
      details,
      confirmed: `Last confirmed ${monthYear(due.confirmedAt)}`,
      confirm: input.confirmLink(due),
      markerUrl,
    };
  });

  const textBody = [
    greeting,
    "",
    why,
    "",
    ...entries.flatMap((e) => [
      e.name,
      ...(e.details ? [e.details] : []),
      e.confirmed,
      `  Still current: ${e.confirm}`,
      `  Update details: ${e.markerUrl}`,
      `  This site has closed: ${e.markerUrl}`,
      "",
    ]),
    fade,
    "",
    NO_REPLY_TEXT,
    "",
    `To stop these reminders: ${input.unsubscribeLink}`,
    "",
  ].join("\n");

  const p = (s: string) => `<p>${s}</p>`;
  const a = (href: string, label: string) => `<a href="${escape(href)}">${escape(label)}</a>`;
  const html = [
    '<!doctype html><html><body style="font-family: sans-serif; line-height: 1.5">',
    p(escape(greeting)),
    p(escape(why)),
    ...entries.map(
      (e) =>
        `<p><strong>${escape(e.name)}</strong><br>` +
        (e.details ? `${escape(e.details)}<br>` : "") +
        `${escape(e.confirmed)}<br>` +
        `${a(e.confirm, "Still current")} · ${a(e.markerUrl, "Update details")} · ${a(e.markerUrl, "This site has closed")}</p>`,
    ),
    p(escape(fade)),
    p(NO_REPLY_HTML),
    p(`${a(input.unsubscribeLink, "Unsubscribe")} from these reminders.`),
    "</body></html>",
  ].join("\n");

  return { subject, text: textBody, html };
}

export interface ReminderJobDeps {
  store: Pick<EditStore, "readEdits" | "appendRows">;
  accounts: Accounts;
  mailer: Mailer;
  signer: LinkSigner;
  siteUrl: string;
  now: () => Date;
}

export interface ReminderRun {
  sent: number;
  withheld: number;
  skipped: number;
  failed: number;
  /** People due but left for later days by the daily limit or a failure. */
  remaining: number;
}

/** Rows are written in batches to stay within Sheets write quotas. */
const FLUSH_EVERY = 10;

/** One daily run. Must run inside the write queue. */
export async function runReminders(deps: ReminderJobDeps): Promise<ReminderRun> {
  const now = deps.now();
  const sheet = await deps.store.readEdits();
  const { people, skipped, sentToday } = selectDue(sheet, now);
  const site = deps.siteUrl.replace(/\/+$/, "");
  const run: ReminderRun = {
    sent: 0,
    withheld: 0,
    skipped: skipped.length,
    failed: 0,
    remaining: 0,
  };
  let pending: ReminderRow[] = [...skipped];
  let budget = DAILY_LIMIT - sentToday;

  const flush = async () => {
    if (pending.length === 0) return;
    await deps.store.appendRows(
      "reminders",
      pending.map((r) => COLUMNS.reminders.map((c) => r[c])),
    );
    pending = [];
  };
  const record = (person: (typeof people)[number], result: string) => {
    const stamp = deps.now().toISOString();
    for (const due of person.markers) {
      pending.push({
        marker_id: due.marker.id,
        stage: due.stage,
        confirmed_at: due.confirmedAt,
        username: person.username,
        sent_at: stamp,
        result,
      });
    }
  };

  try {
    for (const [index, person] of people.entries()) {
      if (budget <= 0) {
        run.remaining = people.length - index;
        break;
      }
      let account;
      try {
        account = await deps.accounts.lookup(person.username);
      } catch (err) {
        if (!(err instanceof AccountsUnavailable)) throw err;
        // Leave everyone left for the next run rather than hammer a Keycloak that is down.
        console.error(JSON.stringify({ event: "reminders-accounts-unavailable" }));
        run.failed += 1;
        run.remaining = people.length - index;
        break;
      }
      const skip = !account
        ? "no account"
        : !account.enabled
          ? "disabled"
          : !account.email
            ? "no email"
            : undefined;
      if (skip) {
        record(person, skip);
        run.skipped += 1;
        continue;
      }
      const email = renderReminder({
        username: person.username,
        name: account!.name,
        markers: person.markers,
        siteUrl: site,
        confirmLink: (due) =>
          `${site}/reminder#${deps.signer.confirm(due.marker.id, due.confirmedAt, person.username, now)}`,
        unsubscribeLink: `${site}/reminder#${deps.signer.unsubscribe(person.username, now)}`,
      });
      const result = await deps.mailer.send({
        to: account!.email!,
        ...email,
        kind: "reminder",
        markers: person.markers.map((m) => m.marker.id),
      });
      if (result.status === "sent") {
        record(person, "sent");
        run.sent += 1;
        budget -= 1;
      } else if (result.status === "withheld") {
        record(person, "withheld");
        run.withheld += 1;
      } else if (result.status === "rejected") {
        record(person, `rejected: ${result.reason}`);
        run.skipped += 1;
      } else {
        // Failed or email off: record nothing, so the next run tries again.
        run.failed += 1;
        if (result.status === "off") {
          run.remaining = people.length - index;
          break;
        }
      }
      if (pending.length >= FLUSH_EVERY) await flush();
    }
  } finally {
    await flush();
  }
  return run;
}
