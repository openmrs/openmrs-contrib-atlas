import { COLUMNS } from "@openmrs-atlas/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsUnavailable, type Account, type Accounts } from "./accounts.ts";
import { createApp, type AppDeps } from "./app.ts";
import { linkSigner } from "./links.ts";
import type { Email, Mailer, SendResult } from "./mailer.ts";
import { FakeBucket, FakeSheet, ID, NOW, OLD, SECRET_EMAIL } from "./testing.ts";

/** Specs: account-lookup, reminder-emails, entry-notices, and ID checks in marker-ownership. */

const signer = linkSigner("k".repeat(43));
const SCHEDULER = "scheduler@project.iam.gserviceaccount.com";
const USERS: Record<string, Account> = {
  jdoe: { username: "jdoe", name: "Jane Doe", email: "jane@example.org", enabled: true },
  asmith: { username: "asmith", name: "Al Smith", email: "al@example.org", enabled: true },
  bnew: { username: "bnew", name: "Bea New", email: "bea@example.org", enabled: true },
  olduser: { username: "olduser", name: "Old", email: "old@example.org", enabled: false },
};

class SpyAccounts implements Accounts {
  calls: string[] = [];
  down = false;
  async lookup(username: string) {
    this.calls.push(`lookup:${username}`);
    if (this.down) throw new AccountsUnavailable("down");
    return USERS[username.toLowerCase()];
  }
  async check(username: string) {
    this.calls.push(`check:${username}`);
    if (this.down) throw new AccountsUnavailable("down");
    return USERS[username.toLowerCase()]?.enabled === true;
  }
  async search(text: string) {
    this.calls.push(`search:${text}`);
    if (this.down) throw new AccountsUnavailable("down");
    return Object.values(USERS)
      .filter((u) => u.enabled && (u.username + u.name).toLowerCase().includes(text.toLowerCase()))
      .map(({ username, name }) => ({ username, name }));
  }
}

class SpyMailer implements Mailer {
  sent: Email[] = [];
  result: SendResult | "throw" = { status: "sent" };
  async send(email: Email) {
    this.sent.push(email);
    if (this.result === "throw") throw new Error("mandrill exploded");
    return this.result;
  }
}

let sheet: FakeSheet;
let bucket: FakeBucket;
let accounts: SpyAccounts;
let mailer: SpyMailer;
let app: ReturnType<typeof createApp>;
let now: Date;

function build(overrides: Partial<AppDeps> = {}) {
  return createApp({
    siteUrl: "https://atlas.example.org",
    sheet,
    snapshots: bucket,
    auth: { publishSecret: "publish-secret", schedulerEmail: SCHEDULER, audience: "aud" },
    verify: async (token) => (token === "scheduler-oidc" ? SCHEDULER : undefined),
    now: () => now,
    editing: {
      store: sheet,
      verifyPerson: async (token) =>
        token.startsWith("person:") || token.startsWith("admin:")
          ? {
              username: token.split(":")[1]!,
              admin: token.startsWith("admin:"),
              email: `${token.split(":")[1]}@own-token.example`,
            }
          : undefined,
      logos: { saveLogo: async (name) => name },
    },
    accounts,
    reminders: { mailer, signer },
    notices: {
      mailer,
      to: "admins@example.org",
      siteUrl: "https://atlas.example.org",
      sheetUrl: "https://docs.google.com/spreadsheets/d/x/edit",
    },
    ...overrides,
  });
}

beforeEach(() => {
  sheet = new FakeSheet();
  bucket = new FakeBucket();
  accounts = new SpyAccounts();
  mailer = new SpyMailer();
  now = NOW;
  app = build();
});

function call(who: string | undefined, method: string, path: string, body?: unknown, target = app) {
  return Promise.resolve(
    target.request(path, {
      method,
      headers: {
        ...(who ? { Authorization: `Bearer ${who}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}

const confirmToken = (confirmedAt = OLD, username = "jdoe") =>
  signer.confirm(ID, confirmedAt, username, NOW);

describe("Account lookups have a trusted trigger", () => {
  it("Scenario: Anonymous search, and every lookup route without a valid sign-in", async () => {
    for (const who of [undefined, "bad-token"]) {
      expect((await call(who, "GET", "/api/accounts?q=smith")).status).toBe(401);
      expect((await call(who, "GET", "/api/accounts/asmith")).status).toBe(401);
      expect(
        (await call(who, "POST", `/api/markers/${ID}/editors`, { username: "bnew" })).status,
      ).toBe(401);
      expect(
        (await call(who, "POST", `/api/markers/${ID}/transfer`, { username: "bnew" })).status,
      ).toBe(401);
      expect((await call(who, "POST", "/api/markers", { fields: {}, owner: "bnew" })).status).toBe(
        401,
      );
      expect((await call(who, "POST", "/reminders")).status).toBe(401);
    }
    expect(accounts.calls).toEqual([]);
  });

  it("Scenario: Emailed link, and /publish, never call Keycloak", async () => {
    await call(undefined, "POST", "/api/reminder/view", { token: confirmToken() });
    await call(undefined, "POST", "/api/reminder/confirm", { token: confirmToken() });
    await call(undefined, "POST", "/api/reminder/unsubscribe", {
      token: signer.unsubscribe("jdoe", NOW),
    });
    await call(undefined, "POST", "/api/reminder/confirm", { token: "forged.token" });
    await call("publish-secret", "POST", "/publish");
    expect(accounts.calls).toEqual([]);
  });
});

describe("Account search", () => {
  it("Scenario: Find a colleague", async () => {
    const res = await call("person:jdoe", "GET", "/api/accounts?q=smit");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accounts: [{ username: "asmith", name: "Al Smith" }] });
  });

  it("Scenario: Too short", async () => {
    expect((await call("person:jdoe", "GET", "/api/accounts?q=sm")).status).toBe(400);
    expect(accounts.calls).toEqual([]);
  });

  it("Scenario: Too many searches", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await call("person:jdoe", "GET", "/api/accounts?q=smith")).status).toBe(200);
    }
    expect((await call("person:jdoe", "GET", "/api/accounts?q=smith")).status).toBe(429);
    // Per person, and the window moves on.
    expect((await call("person:asmith", "GET", "/api/accounts?q=smith")).status).toBe(200);
    now = new Date(NOW.getTime() + 61_000);
    expect((await call("person:jdoe", "GET", "/api/accounts?q=smith")).status).toBe(200);
  });

  it("checks one OpenMRS ID, treating disabled accounts as not found", async () => {
    expect(await (await call("person:jdoe", "GET", "/api/accounts/ASmith")).json()).toEqual({
      username: "asmith",
      name: "Al Smith",
    });
    expect((await call("person:jdoe", "GET", "/api/accounts/olduser")).status).toBe(404);
    expect((await call("person:jdoe", "GET", "/api/accounts/nobody")).status).toBe(404);
  });

  it("answers 503 when lookups aren't set up", async () => {
    const plain = build({ accounts: undefined });
    expect(
      (await call("person:jdoe", "GET", "/api/accounts?q=smith", undefined, plain)).status,
    ).toBe(503);
  });
});

describe("Emails stay inside the service", () => {
  it("Scenario: Own email, and no one else's in any response", async () => {
    const me = (await (await call("person:jdoe", "GET", "/api/me")).json()) as Record<
      string,
      unknown
    >;
    expect(me.email).toBe("jdoe@own-token.example");
    expect(me.reminders).toBe(true);
    const responses = [
      JSON.stringify(me),
      await (await call("person:jdoe", "GET", "/api/accounts?q=a")).text(),
      await (await call("person:jdoe", "GET", "/api/accounts/asmith")).text(),
      await (await call("person:jdoe", "GET", `/api/markers/${ID}`)).text(),
      await (
        await call("person:jdoe", "POST", `/api/markers/${ID}/editors`, { username: "bnew" })
      ).text(),
    ];
    for (const body of responses) {
      for (const user of Object.values(USERS)) expect(body).not.toContain(user.email);
    }
  });
});

describe("Manage editors, with OpenMRS IDs checked", () => {
  it("Scenario: Add an editor that exists", async () => {
    const res = await call("person:jdoe", "POST", `/api/markers/${ID}/editors`, {
      username: "BNew",
    });
    expect(res.status).toBe(200);
    expect(sheet.priv("editors")).toBe("asmith,bnew");
  });

  it("Scenario: Unknown OpenMRS ID", async () => {
    for (const username of ["asmiht", "olduser"]) {
      const res = await call("person:jdoe", "POST", `/api/markers/${ID}/editors`, { username });
      expect(res.status).toBe(422);
      expect(JSON.stringify(await res.json())).toContain("was not found");
    }
    expect(sheet.priv("editors")).toBe("asmith");
  });

  it("Scenario: Adding an editor while Keycloak is down", async () => {
    accounts.down = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call("person:jdoe", "POST", `/api/markers/${ID}/editors`, {
      username: "bnew",
    });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toContain("try again");
    expect(sheet.priv("editors")).toBe("asmith");
    vi.restoreAllMocks();
  });

  it("accepts IDs unchecked when lookups aren't set up", async () => {
    const plain = build({ accounts: undefined });
    const res = await call(
      "person:jdoe",
      "POST",
      `/api/markers/${ID}/editors`,
      { username: "anyone" },
      plain,
    );
    expect(res.status).toBe(200);
  });
});

describe("Transfer ownership, with the recipient checked", () => {
  it("Scenario: Offer to an unknown OpenMRS ID", async () => {
    const res = await call("person:jdoe", "POST", `/api/markers/${ID}/transfer`, {
      username: "nobody",
    });
    expect(res.status).toBe(422);
    expect(sheet.tabs.pending).toHaveLength(1);
  });

  it("offers to an OpenMRS ID that exists", async () => {
    expect(
      (await call("person:jdoe", "POST", `/api/markers/${ID}/transfer`, { username: "bnew" }))
        .status,
    ).toBe(200);
  });
});

describe("Admin permissions, with owners checked", () => {
  it("Scenario: Admin names an unknown owner", async () => {
    const res = await call("admin:boss", "PATCH", `/api/markers/${ID}`, {
      version: OLD,
      owner: "nosuchuser",
    });
    expect(res.status).toBe(422);
    expect(sheet.priv("owner")).toBe("jdoe");
  });

  it("checks only owners and editors that change", async () => {
    const res = await call("admin:boss", "PATCH", `/api/markers/${ID}`, {
      version: OLD,
      owner: "jdoe",
      editors: ["asmith", "bnew"],
      fields: { name: "Renamed" },
    });
    expect(res.status).toBe(200);
    expect(accounts.calls).toEqual(["check:bnew"]);
  });

  it("checks an owner named when adding on someone's behalf, but not the admin themselves", async () => {
    const fields = { name: "New site", latitude: 0.5, longitude: 32.5, type: "Clinical" };
    expect(
      (await call("admin:boss", "POST", "/api/markers", { fields, owner: "ghost" })).status,
    ).toBe(422);
    expect(
      (await call("admin:boss", "POST", "/api/markers", { fields, owner: "bnew" })).status,
    ).toBe(201);
    accounts.calls = [];
    expect((await call("person:newbie", "POST", "/api/markers", { fields })).status).toBe(201);
    expect(accounts.calls).toEqual([]);
  });
});

describe('Emailed "still current" link', () => {
  it("Scenario: Link opened by a mail scanner", async () => {
    const res = await call(undefined, "POST", "/api/reminder/view", { token: confirmToken() });
    expect(await res.json()).toEqual({
      purpose: "confirm",
      state: "ready",
      marker: { id: ID, name: "Clinic", organisation: "", status: "active", confirmed_at: OLD },
    });
    expect(sheet.marker("confirmed_at")).toBe(OLD);
    expect(bucket.writes).toBe(0);
  });

  it("Scenario: Confirm from email", async () => {
    const res = await call(undefined, "POST", "/api/reminder/confirm", { token: confirmToken() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: "done", confirmed_at: NOW.toISOString() });
    expect(sheet.marker("confirmed_at")).toBe(NOW.toISOString());
    expect(sheet.lastChange()).toMatchObject({ user: "reminder-link:jdoe", action: "confirm" });
    expect(bucket.writes).toBe(1);
  });

  it("Scenario: Link used twice, or after another recipient confirmed", async () => {
    await call(undefined, "POST", "/api/reminder/confirm", { token: confirmToken() });
    for (const token of [confirmToken(), confirmToken(OLD, "asmith")]) {
      const res = await call(undefined, "POST", "/api/reminder/confirm", { token });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ state: "confirmed", confirmed_at: NOW.toISOString() });
    }
  });

  it("dies once the marker is confirmed on the map", async () => {
    await call("person:jdoe", "POST", `/api/markers/${ID}/confirm`);
    const view = await call(undefined, "POST", "/api/reminder/view", { token: confirmToken() });
    expect(((await view.json()) as { state: string }).state).toBe("confirmed");
    expect(
      (await call(undefined, "POST", "/api/reminder/confirm", { token: confirmToken() })).status,
    ).toBe(409);
  });

  it("Scenario: Expired link", async () => {
    now = new Date(NOW.getTime() + 31 * 86_400_000);
    const view = await call(undefined, "POST", "/api/reminder/view", { token: confirmToken() });
    expect(((await view.json()) as { state: string }).state).toBe("expired");
    const res = await call(undefined, "POST", "/api/reminder/confirm", { token: confirmToken() });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ state: "expired", marker: { id: ID } });
    expect(sheet.marker("confirmed_at")).toBe(OLD);
  });

  it("Scenario: Forged link", async () => {
    const forged = linkSigner("x".repeat(43)).confirm(ID, OLD, "jdoe", NOW);
    for (const token of [forged, "nonsense", undefined]) {
      const res = await call(undefined, "POST", "/api/reminder/confirm", { token });
      expect(res.status).toBe(400);
    }
    expect(sheet.marker("confirmed_at")).toBe(OLD);
  });

  it("refuses closed markers and an unsubscribe token used to confirm", async () => {
    const unsub = signer.unsubscribe("jdoe", NOW);
    expect((await call(undefined, "POST", "/api/reminder/confirm", { token: unsub })).status).toBe(
      400,
    );
    sheet.setMarker("status", "closed");
    const res = await call(undefined, "POST", "/api/reminder/confirm", { token: confirmToken() });
    expect(await res.json()).toMatchObject({ state: "inactive" });
  });

  it("works without a session but never with the sign-in check in the way", async () => {
    const res = await call("bad-token", "POST", "/api/reminder/confirm", { token: confirmToken() });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("Unsubscribe", () => {
  it("Scenario: Unsubscribe, then turn reminders back on in My markers", async () => {
    const token = signer.unsubscribe("jdoe", NOW);
    const view = await call(undefined, "POST", "/api/reminder/view", { token });
    expect(await view.json()).toEqual({ purpose: "unsubscribe", state: "ready", username: "jdoe" });
    expect(sheet.tabs.unsubscribed).toHaveLength(1);
    expect((await call(undefined, "POST", "/api/reminder/unsubscribe", { token })).status).toBe(
      200,
    );
    expect(sheet.tabs.unsubscribed!.slice(1).filter((r) => r.length)).toEqual([
      ["jdoe", NOW.toISOString()],
    ]);
    // A second press changes nothing.
    await call(undefined, "POST", "/api/reminder/unsubscribe", { token });
    expect(sheet.tabs.unsubscribed!.filter((r) => r.length)).toHaveLength(2);
    expect(
      ((await (await call("person:jdoe", "GET", "/api/me")).json()) as { reminders: boolean })
        .reminders,
    ).toBe(false);

    const on = await call("person:jdoe", "PUT", "/api/me/reminders", { on: true });
    expect(await on.json()).toEqual({ reminders: true });
    expect(sheet.tabs.unsubscribed!.filter((r) => r.length)).toHaveLength(1);
    expect(
      ((await (await call("person:jdoe", "GET", "/api/me")).json()) as { reminders: boolean })
        .reminders,
    ).toBe(true);
  });

  it("turns reminders off from My markers too", async () => {
    await call("person:jdoe", "PUT", "/api/me/reminders", { on: false });
    expect(sheet.tabs.unsubscribed![1]).toEqual(["jdoe", NOW.toISOString()]);
    expect((await call("person:jdoe", "PUT", "/api/me/reminders", { on: "yes" })).status).toBe(400);
  });
});

describe("The daily job is protected", () => {
  it("Scenario: Anonymous request", async () => {
    expect((await call(undefined, "POST", "/reminders")).status).toBe(401);
    expect((await call("publish-secret", "POST", "/reminders")).status).toBe(401);
    expect((await call("person:jdoe", "POST", "/reminders")).status).toBe(403);
    expect(mailer.sent).toHaveLength(0);
    expect(accounts.calls).toEqual([]);
  });

  it("runs for the scheduler and for signed-in admins", async () => {
    const res = await call("scheduler-oidc", "POST", "/reminders");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sent: 2 });
    expect(mailer.sent.map((e) => e.to).sort()).toEqual(["al@example.org", "jane@example.org"]);
    expect(JSON.stringify(sheet.tabs.reminders)).not.toContain("@");
    expect(JSON.stringify(sheet.tabs.reminders)).not.toContain(SECRET_EMAIL);
    expect((await call("admin:boss", "POST", "/reminders")).status).toBe(200);
  });

  it("answers 503 when reminders aren't set up", async () => {
    const plain = build({ reminders: undefined });
    expect((await call("scheduler-oidc", "POST", "/reminders", undefined, plain)).status).toBe(503);
    expect(
      (await call(undefined, "POST", "/api/reminder/view", { token: "x" }, plain)).status,
    ).toBe(401);
  });
});

describe("Notice when a marker is added", () => {
  const fields = { name: "Eldoret Clinic", latitude: 0.5, longitude: 35.27, type: "Clinical" };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("Scenario: Marker added", async () => {
    expect((await call("person:newbie", "POST", "/api/markers", { fields })).status).toBe(201);
    await settle();
    expect(mailer.sent).toHaveLength(1);
    const notice = mailer.sent[0]!;
    expect(notice).toMatchObject({ to: "admins@example.org", kind: "notice" });
    expect(notice.subject).toContain("Eldoret Clinic");
    expect(notice.text).toContain("newbie");
    expect(notice.text).toContain("Country: KE");
    expect(notice.text).toContain("https://atlas.example.org/?marker=");
    expect(notice.text).toContain("https://docs.google.com/spreadsheets/d/x/edit");
    expect(notice.text).toContain("OpenMRS on Slack (https://openmrs.slack.com/)");
  });

  it("Scenario: No notice address", async () => {
    const quiet = build({
      notices: { mailer, siteUrl: "s", sheetUrl: "s" },
    });
    expect((await call("person:newbie", "POST", "/api/markers", { fields }, quiet)).status).toBe(
      201,
    );
    await settle();
    expect(mailer.sent).toHaveLength(0);
  });

  it("Scenario: Other changes", async () => {
    await call("person:jdoe", "PATCH", `/api/markers/${ID}`, {
      version: OLD,
      fields: { name: "X" },
    });
    await call("person:jdoe", "POST", `/api/markers/${ID}/confirm`);
    await call("person:jdoe", "POST", `/api/markers/${ID}/close`);
    await call("person:jdoe", "DELETE", `/api/markers/${ID}`);
    await settle();
    expect(mailer.sent).toHaveLength(0);
  });

  it("Scenario: Mandrill down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mailer.result = "throw";
    const res = await call("person:newbie", "POST", "/api/markers", { fields });
    await settle();
    expect(res.status).toBe(201);
    expect(sheet.tabs.markers).toHaveLength(3);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("notice-failed"));
    vi.restoreAllMocks();
  });
});

it("keeps reminder columns in the order the sheet expects", () => {
  expect(COLUMNS.reminders).toEqual([
    "marker_id",
    "stage",
    "confirmed_at",
    "username",
    "sent_at",
    "result",
  ]);
});
