import { COLUMNS, type Cell } from "@openmrs-atlas/shared";
import { SEED_LOOKUPS } from "@openmrs-atlas/shared/seed";
import { describe, expect, it } from "vitest";
import { AccountsUnavailable, type Account, type Accounts } from "./accounts.ts";
import type { EditValues } from "./edits.ts";
import { linkSigner } from "./links.ts";
import type { Email, Mailer, SendResult } from "./mailer.ts";
import {
  DAILY_LIMIT,
  addMonths,
  renderReminder,
  runReminders,
  selectDue,
  stageFor,
} from "./reminders.ts";

const NOW = new Date("2026-11-03T14:00:00.000Z");
const SITE = "https://atlas.example.org";
const signer = linkSigner("k".repeat(43));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const monthsAgo = (months: number, extraDays = 1) =>
  new Date(addMonths(NOW.toISOString(), -months).getTime() - extraDays * 86_400_000).toISOString();

interface Site {
  n: number;
  confirmed: string;
  status?: string;
  owner?: string;
  editors?: string;
}

/** A sheet with the given markers; tests change tabs directly. */
function sheetOf(
  sites: Site[],
  extra: Partial<EditValues> = {},
): EditValues & { appended: Cell[][] } {
  const markers = sites.map((s) =>
    COLUMNS.markers.map(
      (c) =>
        (
          ({
            id: id(s.n),
            name: `Site ${s.n}`,
            latitude: -1.29,
            longitude: 36.82,
            type: "Clinical",
            created_at: "2020-01-01T00:00:00.000Z",
            updated_at: s.confirmed,
            confirmed_at: s.confirmed,
            status: s.status ?? "active",
          }) as Record<string, Cell>
        )[c] ?? "",
    ),
  );
  const priv = sites.map((s) => [id(s.n), s.owner ?? `owner${s.n}`, s.editors ?? "", "", ""]);
  return {
    markers: [[...COLUMNS.markers], ...markers],
    private: [[...COLUMNS.private], ...priv],
    pending: [[...COLUMNS.pending]],
    reminders: [[...COLUMNS.reminders]],
    unsubscribed: [[...COLUMNS.unsubscribed]],
    types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
    distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
    versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
    ...extra,
    appended: [],
  };
}

function fakeAccounts(
  users: Record<string, Partial<Account>> | "everyone",
  options: { down?: boolean } = {},
): Accounts & { lookups: string[] } {
  const lookups: string[] = [];
  const find = (username: string): Account | undefined => {
    if (users === "everyone") {
      return {
        username,
        name: `Name ${username}`,
        email: `${username}@example.org`,
        enabled: true,
      };
    }
    const u = users[username];
    return u ? { username, name: "", enabled: true, ...u } : undefined;
  };
  return {
    lookups,
    async lookup(username) {
      lookups.push(username);
      if (options.down) throw new AccountsUnavailable("down");
      return find(username);
    },
    async check(username) {
      return find(username)?.enabled === true;
    },
    async search() {
      return [];
    },
  };
}

function fakeMailer(result: (email: Email) => SendResult = () => ({ status: "sent" })) {
  const sent: Email[] = [];
  const mailer: Mailer & { sent: Email[] } = {
    sent,
    async send(email) {
      sent.push(email);
      return result(email);
    },
  };
  return mailer;
}

async function run(
  sheet: ReturnType<typeof sheetOf>,
  accounts: Accounts = fakeAccounts("everyone"),
  mailer = fakeMailer(),
  now = NOW,
) {
  const store = {
    async readEdits() {
      return sheet;
    },
    async appendRows(tab: string, rows: Cell[][]) {
      expect(tab).toBe("reminders");
      sheet.reminders.push(...rows);
      sheet.appended.push(...rows);
    },
  };
  const result = await runReminders({
    store,
    accounts,
    mailer,
    signer,
    siteUrl: SITE,
    helpUrl: "https://talk.openmrs.org",
    now: () => now,
  });
  const rows = sheet.appended.map((r) =>
    Object.fromEntries(COLUMNS.reminders.map((c, i) => [c, r[i]])),
  );
  sheet.appended = [];
  return { result, rows, mailer };
}

describe("When reminders are due", () => {
  it("counts calendar months in UTC, keeping the day or the month's last day", () => {
    expect(addMonths("2025-01-31T10:00:00.000Z", 1).toISOString()).toBe("2025-02-28T10:00:00.000Z");
    expect(addMonths("2025-11-03T14:00:00.000Z", 12).toISOString()).toBe(
      "2026-11-03T14:00:00.000Z",
    );
  });

  it("Scenario: First reminder", () => {
    expect(stageFor(monthsAgo(12), NOW)).toBe(12);
    expect(stageFor(monthsAgo(12, -2), NOW)).toBeUndefined();
    expect(stageFor(monthsAgo(18), NOW)).toBe(18);
    expect(stageFor(monthsAgo(60), NOW)).toBe(24);
  });

  it("Scenario: Long-neglected marker", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(60) }]);
    const first = await run(sheet);
    expect(first.rows).toEqual([
      expect.objectContaining({ marker_id: id(1), stage: 24, username: "owner1", result: "sent" }),
    ]);
    // A year later, still unconfirmed: nothing more.
    const later = await run(sheet, undefined, fakeMailer(), new Date("2027-11-03T14:00:00Z"));
    expect(later.mailer.sent).toHaveLength(0);
  });

  it("Scenario: Confirmed after a reminder", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(12) }]);
    await run(sheet);
    // Confirmed today: the old reminder row no longer matches, and nothing is due yet.
    sheet.markers[1]![COLUMNS.markers.indexOf("confirmed_at")] = NOW.toISOString();
    expect((await run(sheet)).mailer.sent).toHaveLength(0);
    const nextYear = new Date(addMonths(NOW.toISOString(), 12).getTime() + 1000);
    const next = await run(sheet, undefined, fakeMailer(), nextYear);
    expect(next.rows).toEqual([
      expect.objectContaining({ stage: 12, confirmed_at: NOW.toISOString() }),
    ]);
  });

  it("Scenario: Closed marker", async () => {
    const sheet = sheetOf([
      { n: 1, confirmed: monthsAgo(18), status: "closed" },
      { n: 2, confirmed: monthsAgo(18), status: "hidden" },
      { n: 3, confirmed: monthsAgo(18), status: "deleted" },
    ]);
    const { mailer, rows } = await run(sheet);
    expect(mailer.sent).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });
});

describe("Who receives reminders", () => {
  it("Scenario: Owner and editor, each at their OpenMRS ID email, never the contact email", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(13), owner: "jdoe", editors: "asmith" }]);
    sheet.private[1]![4] = "contact@example.org";
    const { mailer } = await run(sheet);
    expect(mailer.sent.map((e) => e.to).sort()).toEqual(["asmith@example.org", "jdoe@example.org"]);
  });

  it("Scenario: Orphaned marker", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(13), owner: "" }]);
    const { mailer, rows } = await run(sheet);
    expect(mailer.sent).toHaveLength(0);
    expect(rows).toEqual([expect.objectContaining({ username: "", result: "no owner" })]);
    // Recorded once, not every day.
    expect((await run(sheet)).rows).toHaveLength(0);
  });

  it("Scenario: Unsubscribed person", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(13), owner: "jdoe", editors: "asmith" }]);
    sheet.unsubscribed.push(["JDoe", NOW.toISOString()]);
    const { mailer, rows } = await run(sheet);
    expect(mailer.sent.map((e) => e.to)).toEqual(["asmith@example.org"]);
    expect(rows).toContainEqual(
      expect.objectContaining({ username: "jdoe", result: "unsubscribed" }),
    );
  });

  it("Scenario: Account without an email, and missing or disabled accounts", async () => {
    const sheet = sheetOf([
      { n: 1, confirmed: monthsAgo(13), owner: "noemail" },
      { n: 2, confirmed: monthsAgo(13), owner: "gone" },
      { n: 3, confirmed: monthsAgo(13), owner: "off" },
    ]);
    const accounts = fakeAccounts({ noemail: {}, off: { email: "x@y.z", enabled: false } });
    const { mailer, rows } = await run(sheet, accounts);
    expect(mailer.sent).toHaveLength(0);
    expect(rows.map((r) => [r.username, r.result])).toEqual(
      expect.arrayContaining([
        ["noemail", "no email"],
        ["gone", "no account"],
        ["off", "disabled"],
      ]),
    );
  });
});

describe("One email per person", () => {
  it("Scenario: Owner of several markers", async () => {
    const sheet = sheetOf([
      { n: 1, confirmed: monthsAgo(13), owner: "jdoe" },
      { n: 2, confirmed: monthsAgo(30), owner: "jdoe" },
      { n: 3, confirmed: monthsAgo(19), owner: "jdoe" },
    ]);
    const { mailer, rows } = await run(sheet);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]!.markers).toEqual([id(2), id(3), id(1)]);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.sent_at)).size).toBe(1);
  });
});

describe("Daily sending", () => {
  it("Scenario: Large backlog", async () => {
    const sites = Array.from({ length: 300 }, (_, i) => ({
      n: i + 1,
      // Site 300 is the oldest.
      confirmed: monthsAgo(13, i),
    }));
    const sheet = sheetOf(sites);
    const day1 = await run(sheet);
    expect(day1.mailer.sent).toHaveLength(DAILY_LIMIT);
    expect(day1.result).toMatchObject({ sent: 50, remaining: 250 });
    expect(day1.mailer.sent[0]!.markers).toEqual([id(300)]);
    const tomorrow = new Date(NOW.getTime() + 86_400_000);
    const day2 = await run(sheet, undefined, fakeMailer(), tomorrow);
    expect(day2.mailer.sent).toHaveLength(DAILY_LIMIT);
    expect(day2.mailer.sent[0]!.markers).toEqual([id(250)]);
  });

  it("Scenario: Job retried", async () => {
    const sheet = sheetOf([
      { n: 1, confirmed: monthsAgo(13) },
      { n: 2, confirmed: monthsAgo(20) },
    ]);
    await run(sheet);
    const again = await run(sheet, undefined, fakeMailer(), new Date(NOW.getTime() + 3_600_000));
    expect(again.mailer.sent).toHaveLength(0);
  });

  it("counts emails already sent today against the limit, and not withheld ones", async () => {
    const sites = Array.from({ length: 60 }, (_, i) => ({ n: i + 1, confirmed: monthsAgo(13, i) }));
    const sheet = sheetOf(sites);
    for (let i = 0; i < 45; i++) {
      sheet.reminders.push([
        `other-${i}`,
        12,
        monthsAgo(13),
        `p${i}`,
        "2026-11-03T08:00:00.000Z",
        "sent",
      ]);
    }
    sheet.reminders.push(["w", 12, monthsAgo(13), "w", "2026-11-03T08:00:00.000Z", "withheld"]);
    expect((await run(sheet)).mailer.sent).toHaveLength(5);
  });
});

describe("Failed sends are retried by the next run", () => {
  it("Scenario: Mandrill unreachable", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(13) }]);
    const down = await run(
      sheet,
      undefined,
      fakeMailer(() => ({ status: "failed", message: "x" })),
    );
    expect(down.rows).toHaveLength(0);
    expect((await run(sheet)).mailer.sent).toHaveLength(1);
  });

  it("records an address Mandrill rejects as skipped", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(13) }]);
    const { rows } = await run(
      sheet,
      undefined,
      fakeMailer(() => ({ status: "rejected", reason: "hard-bounce" })),
    );
    expect(rows).toEqual([expect.objectContaining({ result: "rejected: hard-bounce" })]);
  });

  it("records withheld staging email so it isn't retried daily", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(13) }]);
    const { rows, result } = await run(
      sheet,
      undefined,
      fakeMailer(() => ({ status: "withheld" })),
    );
    expect(rows).toEqual([expect.objectContaining({ result: "withheld" })]);
    expect(result.withheld).toBe(1);
  });

  it("leaves everyone for the next run when Keycloak is down", async () => {
    const sheet = sheetOf([
      { n: 1, confirmed: monthsAgo(13) },
      { n: 2, confirmed: monthsAgo(14) },
    ]);
    const accounts = fakeAccounts("everyone", { down: true });
    const { rows, mailer, result } = await run(sheet, accounts);
    expect(mailer.sent).toHaveLength(0);
    expect(rows).toHaveLength(0);
    expect(accounts.lookups).toHaveLength(1);
    expect(result.remaining).toBe(2);
  });

  it("records nothing when email is off", async () => {
    const sheet = sheetOf([{ n: 1, confirmed: monthsAgo(13) }]);
    const { rows } = await run(
      sheet,
      undefined,
      fakeMailer(() => ({ status: "off" })),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("Reminder content", () => {
  const sheet = sheetOf([{ n: 1, confirmed: "2024-06-15T00:00:00.000Z" }]);
  const due = selectDue(sheet, NOW).people[0]!.markers;

  it("Scenario: Reminder links", () => {
    const email = renderReminder({
      username: "jdoe",
      name: "Jane Doe",
      markers: due,
      siteUrl: SITE,
      helpUrl: "https://talk.openmrs.org",
      confirmLink: () => `${SITE}/reminder#confirm-token`,
      unsubscribeLink: `${SITE}/reminder#unsub-token`,
    });
    expect(email.subject).toBe("Is Site 1 still current on the OpenMRS Atlas?");
    for (const body of [email.text, email.html]) {
      expect(body).toContain("Still current");
      expect(body).toContain("Update details");
      expect(body).toContain("This site has closed");
      expect(body).toContain(`${SITE}/reminder#confirm-token`);
      expect(body).toContain(`${SITE}/reminder#unsub-token`);
      expect(body).toContain(`${SITE}/?marker=${id(1)}`);
      expect(body).toContain("June 2024");
      expect(body).toContain("jdoe");
      expect(body).toContain("don't reply");
      expect(body).toContain("https://talk.openmrs.org");
      expect(body).toContain("fade");
    }
    expect(email.html).not.toContain("<img");
  });

  it("puts working signed links in the email", async () => {
    const { mailer } = await run(sheetOf([{ n: 1, confirmed: monthsAgo(13), owner: "jdoe" }]));
    const tokens = [...mailer.sent[0]!.text.matchAll(/\/reminder#([\w.-]+)/g)].map((m) => m[1]);
    expect(tokens).toHaveLength(2);
    const [confirm, unsubscribe] = tokens.map((t) => signer.check(t, NOW));
    expect(confirm).toMatchObject({
      ok: true,
      payload: { purpose: "confirm", marker: id(1), username: "jdoe" },
    });
    expect(unsubscribe).toMatchObject({
      ok: true,
      payload: { purpose: "unsubscribe", username: "jdoe" },
    });
  });

  it("escapes marker names in HTML", () => {
    const evil = sheetOf([{ n: 1, confirmed: monthsAgo(13) }]);
    evil.markers[1]![COLUMNS.markers.indexOf("name")] = "<script>x</script>";
    const markers = selectDue(evil, NOW).people[0]!.markers;
    const email = renderReminder({
      username: "u",
      name: "",
      markers,
      siteUrl: SITE,
      helpUrl: "h",
      confirmLink: () => "c",
      unsubscribeLink: "u",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
