import { COLUMNS, type Cell } from "@openmrs-atlas/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsUnavailable, type Account, type Accounts } from "./accounts.ts";
import { createApp, type AppDeps } from "./app.ts";
import { renderClaimDecision, renderClaimNotice } from "./claims-mail.ts";
import { ANOTHER_APPROVED, MAX_PENDING_CLAIMS, NOW_OWNED } from "./edits.ts";
import type { Email, Mailer } from "./mailer.ts";
import { FakeBucket, FakeSheet, ID, NOW, NOW_ISO, OLD } from "./testing.ts";

/** Specs: marker-claims, and the claim parts of marker-ownership and marker-data. */

const USERS: Record<string, Account> = {
  asmith: { username: "asmith", name: "Al Smith", email: "al@example.org", enabled: true },
  bjones: { username: "bjones", name: "Bo Jones", email: "bo@example.org", enabled: true },
  cnomail: { username: "cnomail", name: "No Mail", enabled: true },
  jdoe: { username: "jdoe", name: "Jane Doe", email: "jane@example.org", enabled: true },
};

class SpyAccounts implements Accounts {
  down = false;
  async lookup(username: string) {
    if (this.down) throw new AccountsUnavailable("down");
    return USERS[username];
  }
  async check(username: string) {
    return USERS[username]?.enabled === true;
  }
  async search() {
    return [];
  }
}

class SpyMailer implements Mailer {
  sent: Email[] = [];
  failing = false;
  async send(email: Email) {
    this.sent.push(email);
    if (this.failing) throw new Error("mandrill exploded");
    return { status: "sent" as const };
  }
}

let sheet: FakeSheet;
let bucket: FakeBucket;
let accounts: SpyAccounts;
let mailer: SpyMailer;
let app: ReturnType<typeof createApp>;

function build(overrides: Partial<AppDeps> = {}) {
  return createApp({
    siteUrl: "https://atlas.example.org",
    sheet,
    snapshots: bucket,
    auth: { publishSecret: "s", schedulerEmail: "", audience: "" },
    now: () => NOW,
    editing: {
      store: sheet,
      verifyPerson: async (token) =>
        token === "bad"
          ? undefined
          : { username: token.replace("admin:", ""), admin: token.startsWith("admin:") },
      logos: { saveLogo: async (name) => name },
    },
    accounts,
    notices: {
      mailer,
      to: "admins@example.org",
      siteUrl: "https://atlas.example.org",
      sheetUrl: "https://docs.google.com/spreadsheets/d/x/edit",
    },
    ...overrides,
  });
}

const call = (
  who: string | undefined,
  method: string,
  path: string,
  body?: unknown,
  target = app,
) =>
  Promise.resolve(
    target.request(`/api${path}`, {
      method,
      headers: {
        ...(who ? { Authorization: `Bearer ${who}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const MESSAGE = "I lead the EMR team at this clinic";

/** The sample marker, with no owner. Its editor is asmith. */
function orphan() {
  sheet.tabs.private![1]![COLUMNS.private.indexOf("owner")] = "";
}

const claimCell = (field: string, row = 1): Cell =>
  sheet.tabs.claims![row]![COLUMNS.claims.indexOf(field as never)];

async function claim(who: string, message: unknown = MESSAGE, id = ID) {
  const res = await call(who, "POST", `/markers/${id}/claims`, { message });
  return { res, body: (await res.json()) as { claim?: { id: string }; error?: string } };
}

type Me = {
  claimable: string[];
  claims: { id: string; marker_id: string; name: string }[];
  review?: { id: string; username: string; message: string }[];
};
const me = async (who: string) => (await (await call(who, "GET", "/me")).json()) as Me;

beforeEach(() => {
  sheet = new FakeSheet();
  bucket = new FakeBucket();
  accounts = new SpyAccounts();
  mailer = new SpyMailer();
  app = build();
});

afterEach(() => vi.restoreAllMocks());

describe("Claim a marker with no owner", () => {
  it("Scenario: Claiming an orphan", async () => {
    orphan();
    const { res, body } = await claim("bjones");
    expect(res.status).toBe(201);
    expect(claimCell("id")).toBe(body.claim!.id);
    expect(claimCell("marker_id")).toBe(ID);
    expect(claimCell("username")).toBe("bjones");
    expect(claimCell("message")).toBe(MESSAGE);
    expect(claimCell("created_at")).toBe(NOW_ISO);
    expect(claimCell("status")).toBe("pending");
    expect(sheet.lastChange()).toMatchObject({ user: "bjones", action: "claim" });
    expect(JSON.stringify(sheet.lastChange().fields)).not.toContain(MESSAGE);

    const mine = await me("bjones");
    expect(mine.claims).toEqual([
      { id: body.claim!.id, marker_id: ID, name: "Clinic", created_at: NOW_ISO },
    ]);
    expect(mine.claimable).not.toContain(ID);
  });

  it("Scenario: Marker with an owner", async () => {
    expect((await me("bjones")).claimable).toEqual([]);
    const { res } = await claim("bjones");
    expect(res.status).toBe(409);
    expect(sheet.tabs.claims).toHaveLength(1);
  });

  it("Scenario: Empty message, and one too long", async () => {
    orphan();
    expect((await claim("bjones", "   ")).res.status).toBe(422);
    expect((await claim("bjones", null)).res.status).toBe(422);
    expect((await claim("bjones", "x".repeat(1001))).res.status).toBe(422);
    expect((await claim("bjones", "x".repeat(1000))).res.status).toBe(201);
  });

  it("Scenario: Editor of an orphan", async () => {
    orphan();
    expect((await me("asmith")).claimable).toEqual([ID]);
    expect((await claim("asmith")).res.status).toBe(201);
  });

  it("hidden and deleted markers can't be claimed; closed ones can", async () => {
    orphan();
    sheet.setMarker("status", "hidden");
    expect((await me("bjones")).claimable).toEqual([]);
    expect((await claim("bjones")).res.status).toBe(404);
    sheet.setMarker("status", "deleted");
    expect((await claim("bjones")).res.status).toBe(404);
    sheet.setMarker("status", "closed");
    expect((await me("bjones")).claimable).toEqual([ID]);
    expect((await claim("bjones")).res.status).toBe(201);
  });

  it("needs a sign-in", async () => {
    orphan();
    expect((await claim("bad")).res.status).toBe(401);
  });

  it("stores the message as text, never a formula", async () => {
    orphan();
    await claim("bjones", "=IMPORTXML(1)");
    expect(claimCell("message")).toBe("=IMPORTXML(1)");
  });
});

describe("Claim limits", () => {
  it("Scenario: Second claim on the same marker", async () => {
    orphan();
    await claim("bjones");
    const { res, body } = await claim("bjones");
    expect(res.status).toBe(409);
    expect(body.error).toContain("already waiting");
  });

  it("Scenario: Too many claims", async () => {
    orphan();
    for (let i = 0; i < MAX_PENDING_CLAIMS; i++) {
      sheet.tabs.claims!.push([`c${i}`, `m${i}`, "bjones", "x", OLD, "pending", "", "", ""]);
    }
    const { res, body } = await claim("bjones");
    expect(res.status).toBe(429);
    expect(body.error).toContain("10 claims waiting");
  });
});

describe("Admins are told about claims", () => {
  it("Scenario: Claim sent", async () => {
    orphan();
    await claim("asmith");
    await settle();
    expect(mailer.sent).toHaveLength(1);
    const notice = mailer.sent[0]!;
    expect(notice).toMatchObject({ to: "admins@example.org", kind: "claim-notice", markers: [ID] });
    expect(notice.subject).toBe("Claim for Clinic on the OpenMRS Atlas");
    expect(notice.text).toContain("asmith");
    expect(notice.text).toContain(MESSAGE);
    expect(notice.text).toContain(`https://atlas.example.org/?marker=${ID}`);
  });

  it("escapes the message in HTML and keeps its lines", () => {
    const { html } = renderClaimNotice(
      { marker_id: ID, name: "A & B", username: "x", message: "<b>hi</b>\nthere" },
      { siteUrl: "https://s", sheetUrl: "https://sheet" },
    );
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;<br>there");
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("<b>hi");
  });

  it("No notice address", async () => {
    orphan();
    app = build({ notices: { mailer, siteUrl: "s", sheetUrl: "s" } });
    expect((await claim("asmith")).res.status).toBe(201);
    await settle();
    expect(mailer.sent).toHaveLength(0);
  });

  it("Scenario: Mandrill down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    orphan();
    mailer.failing = true;
    expect((await claim("asmith")).res.status).toBe(201);
    await settle();
    expect(claimCell("status")).toBe("pending");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("claim-notice-failed"));
  });
});

describe("Admins review claims", () => {
  it("Scenario: Admin opens a claimed marker", async () => {
    orphan();
    await claim("asmith");
    await claim("bjones", "Ministry of Health");
    const review = (await me("admin:root")).review!;
    expect(review.map((r) => [r.username, r.message])).toEqual([
      ["asmith", MESSAGE],
      ["bjones", "Ministry of Health"],
    ]);
  });

  it("Scenario: Another person's claim (no review for non-admins)", async () => {
    orphan();
    await claim("asmith");
    const other = await me("bjones");
    expect(other.review).toBeUndefined();
    expect(other.claims).toEqual([]);
  });

  it("Scenario: Non-admin tries to approve or decline", async () => {
    orphan();
    const { body } = await claim("asmith");
    const path = `/markers/${ID}/claims/${body.claim!.id}`;
    expect((await call("asmith", "POST", `${path}/approve`)).status).toBe(403);
    expect((await call("jdoe", "POST", `${path}/decline`, {})).status).toBe(403);
    expect(claimCell("status")).toBe("pending");
  });

  it("claims on deleted markers leave the review", async () => {
    orphan();
    await claim("asmith");
    sheet.setMarker("status", "deleted");
    expect((await me("admin:root")).review).toEqual([]);
    expect((await me("asmith")).claims).toEqual([]);
  });
});

describe("Approving a claim", () => {
  it("Scenario: Claim approved", async () => {
    orphan();
    sheet.tabs.private![1]![COLUMNS.private.indexOf("editors")] = "asmith,bjones";
    const { body } = await claim("bjones");
    const res = await call("admin:root", "POST", `/markers/${ID}/claims/${body.claim!.id}/approve`);
    expect(res.status).toBe(200);
    const result = (await res.json()) as { published: boolean; decisions?: unknown };
    expect(result.published).toBe(true);
    expect(result.decisions).toBeUndefined();
    expect(sheet.priv("owner")).toBe("bjones");
    expect(sheet.priv("editors")).toBe("asmith");
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
    expect(claimCell("status")).toBe("approved");
    expect(claimCell("decided_by")).toBe("root");
    expect(claimCell("decided_at")).toBe(NOW_ISO);
    expect(sheet.lastChange()).toMatchObject({ user: "root", action: "claim-approve" });

    const owner = await me("bjones");
    expect(owner.claims).toEqual([]);
    expect(owner.claimable).toEqual([]);
    await settle();
    expect(mailer.sent).toHaveLength(2); // the notice, then the approval
    const approval = mailer.sent[1]!;
    expect(approval).toMatchObject({ to: "bo@example.org", kind: "claim-decision" });
    expect(approval.subject).toBe("Your claim for Clinic was approved");
    expect(approval.text).toContain(`https://atlas.example.org/?marker=${ID}`);
  });

  it("Scenario: Competing claims", async () => {
    orphan();
    const first = (await claim("asmith")).body.claim!.id;
    await claim("bjones");
    await call("admin:root", "POST", `/markers/${ID}/claims/${first}/approve`);
    expect(claimCell("status", 1)).toBe("approved");
    expect(claimCell("status", 2)).toBe("declined");
    expect(claimCell("reason", 2)).toBe(ANOTHER_APPROVED);
    await settle();
    const decisions = mailer.sent.filter((e) => e.kind === "claim-decision");
    expect(decisions.map((e) => [e.to, e.subject])).toEqual([
      ["al@example.org", "Your claim for Clinic was approved"],
      ["bo@example.org", "Your claim for Clinic was declined"],
    ]);
    expect(decisions[1]!.text).toContain(ANOTHER_APPROVED);
  });

  it("Scenario: Owner set in the sheet meanwhile", async () => {
    orphan();
    const { body } = await claim("bjones");
    sheet.tabs.private![1]![COLUMNS.private.indexOf("owner")] = "jdoe";
    const path = `/markers/${ID}/claims/${body.claim!.id}`;
    expect((await call("admin:root", "POST", `${path}/approve`)).status).toBe(409);
    expect(sheet.priv("owner")).toBe("jdoe");
    expect((await call("admin:root", "POST", `${path}/decline`, {})).status).toBe(200);
    expect(claimCell("status")).toBe("declined");
  });

  it("a second decision gets 410", async () => {
    orphan();
    const { body } = await claim("bjones");
    const path = `/markers/${ID}/claims/${body.claim!.id}`;
    await call("admin:root", "POST", `${path}/decline`, {});
    expect((await call("admin:root", "POST", `${path}/approve`)).status).toBe(410);
    expect((await call("admin:root", "POST", `/markers/${ID}/claims/nope/approve`)).status).toBe(
      404,
    );
  });

  it("nothing from claims reaches the snapshot", async () => {
    orphan();
    const { body } = await claim("bjones", "secret-claim-message");
    await call("admin:root", "POST", `/markers/${ID}/claims/${body.claim!.id}/approve`);
    const json = String(bucket.files.get("atlas.json")!.body);
    expect(json).not.toContain("secret-claim-message");
    expect(json).not.toContain("bjones");
    expect(json).not.toContain("claim");
  });
});

describe("Declining a claim", () => {
  it("Scenario: Declined with a reason", async () => {
    orphan();
    const { body } = await claim("bjones");
    const reason = "Please ask your country lead to claim it";
    const res = await call(
      "admin:root",
      "POST",
      `/markers/${ID}/claims/${body.claim!.id}/decline`,
      {
        reason,
      },
    );
    expect(res.status).toBe(200);
    expect(claimCell("status")).toBe("declined");
    expect(claimCell("reason")).toBe(reason);
    expect(sheet.priv("owner")).toBe("");
    await settle();
    const email = mailer.sent.at(-1)!;
    expect(email).toMatchObject({ to: "bo@example.org", kind: "claim-decision" });
    expect(email.subject).toBe("Your claim for Clinic was declined");
    expect(email.text).toContain(`Reason: ${reason}`);
  });

  it("Scenario: Avoiding links in email", () => {
    for (const approved of [true, false]) {
      const email = renderClaimDecision(
        { marker_id: ID, name: "Clinic", username: "b", approved, reason: "" },
        "https://atlas.example.org",
      );
      const ps =
        "P.S. If you want to avoid clicking on links in email, you can go to the OpenMRS Atlas in your browser at atlas.example.org and sign in with your OpenMRS ID.";
      expect(email.text.trimEnd().endsWith(ps)).toBe(true);
      expect(email.html).toContain(`<p>${ps}</p>\n</body>`);
    }
    // Admin notices don't need it.
    const notice = renderClaimNotice(
      { marker_id: ID, name: "Clinic", username: "b", message: "hi" },
      { siteUrl: "https://atlas.example.org", sheetUrl: "https://sheet" },
    );
    expect(notice.text).not.toContain("P.S.");
  });

  it("without a reason, and refuses a long one", async () => {
    orphan();
    const { body } = await claim("bjones");
    const path = `/markers/${ID}/claims/${body.claim!.id}/decline`;
    expect((await call("admin:root", "POST", path, { reason: "x".repeat(501) })).status).toBe(422);
    expect((await call("admin:root", "POST", path, {})).status).toBe(200);
    expect(
      renderClaimDecision(
        { marker_id: ID, name: "Clinic", username: "b", approved: false, reason: "" },
        "https://s",
      ).text,
    ).not.toContain("Reason");
  });

  it("Scenario: No email on file", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    orphan();
    const { body } = await claim("cnomail");
    await call("admin:root", "POST", `/markers/${ID}/claims/${body.claim!.id}/decline`, {});
    await settle();
    expect(claimCell("status")).toBe("declined");
    expect(mailer.sent.filter((e) => e.kind === "claim-decision")).toHaveLength(0);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("claim-decision-no-email"));
  });

  it("Keycloak down: the decision stands and no address is logged", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    orphan();
    const { body } = await claim("bjones");
    accounts.down = true;
    const res = await call("admin:root", "POST", `/markers/${ID}/claims/${body.claim!.id}/approve`);
    expect(res.status).toBe(200);
    await settle();
    expect(sheet.priv("owner")).toBe("bjones");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("claim-decision-failed"));
    for (const [line] of error.mock.calls) expect(String(line)).not.toContain("@");
  });
});

describe("Owner set while claims are pending", () => {
  it("Scenario: Admin assigns an owner", async () => {
    orphan();
    await claim("asmith");
    const res = await call("admin:root", "PATCH", `/markers/${ID}`, {
      version: OLD,
      owner: "jdoe",
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { decisions?: unknown }).decisions).toBeUndefined();
    expect(claimCell("status")).toBe("declined");
    expect(claimCell("reason")).toBe(NOW_OWNED);
    await settle();
    const email = mailer.sent.at(-1)!;
    expect(email).toMatchObject({ to: "al@example.org", kind: "claim-decision" });
    expect(email.text).toContain(NOW_OWNED);
  });

  it("an ordinary edit leaves claims alone", async () => {
    orphan();
    await claim("asmith");
    await call("admin:root", "PATCH", `/markers/${ID}`, { version: OLD, fields: { name: "X" } });
    expect(claimCell("status")).toBe("pending");
  });
});

describe("Withdrawing a claim", () => {
  it("Scenario: Claimant withdraws", async () => {
    orphan();
    const { body } = await claim("bjones");
    const path = `/markers/${ID}/claims/${body.claim!.id}`;
    expect((await call("asmith", "DELETE", path)).status).toBe(403);
    expect((await call("admin:root", "DELETE", path)).status).toBe(403);
    expect((await call("bjones", "DELETE", path)).status).toBe(200);
    expect(claimCell("status")).toBe("withdrawn");
    expect((await me("admin:root")).review).toEqual([]);
    expect((await me("bjones")).claimable).toEqual([ID]);
    expect((await call("bjones", "DELETE", path)).status).toBe(410);
    expect((await claim("bjones")).res.status).toBe(201);
  });
});

it("keeps claim columns in the order the sheet expects", () => {
  expect(COLUMNS.claims).toEqual([
    "id",
    "marker_id",
    "username",
    "message",
    "created_at",
    "status",
    "decided_by",
    "decided_at",
    "reason",
  ]);
});
