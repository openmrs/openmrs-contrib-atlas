import { ADMIN_GROUP, text } from "@openmrs-atlas/shared";
import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { FakeBucket, FakeSheet, ID, NOW, NOW_ISO, OLD, SECRET_EMAIL } from "./testing.ts";

let sheet: FakeSheet;
let bucket: FakeBucket;
let saved: Map<string, Buffer>;
let call: (
  who: string | undefined,
  method: string,
  path: string,
  body?: unknown,
) => Promise<Response>;

beforeEach(() => {
  sheet = new FakeSheet();
  bucket = new FakeBucket();
  saved = new Map();
  const app = createApp({
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
      logos: {
        async saveLogo(name, body) {
          saved.set(name, body);
          return `https://bucket.example/${name}`;
        },
      },
    },
  });
  call = (who, method, path, body) =>
    Promise.resolve(
      app.request(`/api${path}`, {
        method,
        headers: {
          ...(who ? { Authorization: `Bearer ${who}` } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
});

const edit = (who: string, body: Record<string, unknown>) =>
  call(who, "PATCH", `/markers/${ID}`, { version: OLD, ...body });

describe("Requests are checked by the service", () => {
  it("Scenario: Anonymous edit", async () => {
    expect((await edit("bad", { fields: { name: "X" } })).status).toBe(401);
    expect((await call(undefined, "POST", "/markers", { fields: {} })).status).toBe(401);
    expect(sheet.marker("name")).toBe("Clinic");
  });

  it("answers 503 when sign-in isn't configured", async () => {
    const app = createApp({
      siteUrl: "https://atlas.example.org",
      sheet,
      snapshots: bucket,
      auth: { publishSecret: "s", schedulerEmail: "", audience: "" },
    });
    expect((await app.request("/api/me")).status).toBe(503);
  });

  it("marks every response as uncacheable", async () => {
    const res = await call("jdoe", "GET", "/me");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("Add a marker", () => {
  const fields = { name: "New site", latitude: 0.5, longitude: 32.5, type: "Clinical" };

  it("Scenario: Only required fields", async () => {
    const res = await call("newbie", "POST", "/markers", { fields });
    expect(res.status).toBe(201);
    const { id, marker, published } = (await res.json()) as {
      id: string;
      marker: { name: string; country: string };
      published: boolean;
    };
    expect(marker.name).toBe("New site");
    expect(published).toBe(true);
    expect(sheet.marker("id", 2)).toBe(id);
    for (const f of ["created_at", "updated_at", "confirmed_at"]) {
      expect(sheet.marker(f, 2)).toBe(NOW_ISO);
    }
    expect(sheet.marker("status", 2)).toBe("active");
    expect(sheet.priv("owner", 2)).toBe("newbie");
    expect(sheet.lastChange()).toMatchObject({ user: "newbie", marker_id: id, action: "add" });
  });

  it("Scenario: Admin adds on behalf of someone", async () => {
    const res = await call("admin:root", "POST", "/markers", { fields, owner: "ASmith" });
    expect(res.status).toBe(201);
    expect(sheet.priv("owner", 2)).toBe("asmith");
    expect(sheet.lastChange().user).toBe("root");
  });

  it("refuses naming an owner, unless an admin", async () => {
    expect((await call("jdoe", "POST", "/markers", { fields, owner: "x" })).status).toBe(403);
  });

  it("stores contact details privately", async () => {
    const contact = { contact_email: SECRET_EMAIL };
    expect((await call("jdoe", "POST", "/markers", { fields, contact })).status).toBe(201);
    expect(sheet.priv("contact_email", 2)).toBe(SECRET_EMAIL);
    expect(bucket.files.get("atlas.json")!.body).not.toContain(SECRET_EMAIL);
  });
});

describe("Edit a marker", () => {
  it("Scenario: Owner fixes a website", async () => {
    const res = await edit("jdoe", { fields: { url: "https://new.example" } });
    expect(res.status).toBe(200);
    expect(sheet.marker("url")).toBe("https://new.example");
    expect(sheet.marker("updated_at")).toBe(NOW_ISO);
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
    expect(sheet.marker("created_at")).toBe(OLD);
    expect(sheet.lastChange()).toMatchObject({ user: "jdoe", action: "edit", fields: ["url"] });
  });

  it("Scenario: Saving with nothing changed", async () => {
    expect((await edit("jdoe", { fields: { name: "Clinic" } })).status).toBe(200);
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
  });

  it("Scenario: Editor changes notes", async () => {
    await edit("asmith", { fields: { notes: "Open weekdays" } });
    expect(sheet.lastChange()).toMatchObject({
      user: "asmith",
      marker_id: ID,
      action: "edit",
      fields: ["notes"],
    });
  });

  it("Scenario: Invalid website", async () => {
    const res = await edit("jdoe", { fields: { url: "ftp://example.org" } });
    expect(res.status).toBe(422);
    const { errors } = (await res.json()) as { errors: { field: string }[] };
    expect(errors[0]?.field).toBe("url");
    expect(sheet.marker("url")).toBe("");
    expect(sheet.marker("updated_at")).toBe(OLD);
  });

  it("Scenario: Name too long", async () => {
    const res = await edit("jdoe", { fields: { name: "x".repeat(300) } });
    expect(res.status).toBe(422);
    expect(await res.text()).toContain("name must be 200 characters or fewer");
  });

  it("applies limits only to values being changed", async () => {
    sheet.setMarker("notes", "x".repeat(3000));
    expect((await edit("jdoe", { fields: { name: "New" } })).status).toBe(200);
  });

  it("Scenario: Forged request", async () => {
    for (const fields of [{ confirmed_at: "2030-01-01" }, { id: "other" }, { updated_at: "x" }]) {
      expect((await edit("jdoe", { fields })).status).toBe(400);
    }
    expect((await edit("jdoe", { status: "hidden" })).status).toBe(403);
    expect((await edit("jdoe", { confirmed_at: "2030-01-01" })).status).toBe(400);
    expect(sheet.marker("updated_at")).toBe(OLD);
  });

  it("Scenario: Formula in a name", async () => {
    const name = '=IMPORTXML("http://example.org","//a")';
    await edit("jdoe", { fields: { name } });
    expect(sheet.marker("name")).toBe(name);
  });

  it("Scenario: Two people edit one marker", async () => {
    expect((await edit("jdoe", { fields: { notes: "first" } })).status).toBe(200);
    expect((await edit("asmith", { fields: { notes: "second" } })).status).toBe(409);
    expect(sheet.marker("notes")).toBe("first");
  });

  it("refuses a save after a direct sheet edit", async () => {
    sheet.setMarker("updated_at", "2026-10-01T00:00:00.000Z");
    expect((await edit("jdoe", { fields: { notes: "x" } })).status).toBe(409);
  });

  it("returns what the map needs", async () => {
    const res = await edit("jdoe", { fields: { name: "Renamed" } });
    expect(await res.json()).toMatchObject({
      version: NOW_ISO,
      status: "active",
      published: true,
      marker: { id: ID, name: "Renamed", country: "KE" },
    });
  });
});

describe("Still current", () => {
  it("Scenario: Confirming a faded marker", async () => {
    expect((await call("asmith", "POST", `/markers/${ID}/confirm`)).status).toBe(200);
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
    expect(sheet.marker("updated_at")).toBe(NOW_ISO);
    expect(sheet.marker("name")).toBe("Clinic");
    expect(sheet.lastChange().action).toBe("confirm");
  });
});

describe("Signing in keeps recent markers current", () => {
  const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
  const signIn = async (who: string) => {
    const res = await call(who, "POST", "/me/confirm-recent");
    expect(res.status).toBe(200);
    return (await res.json()) as { confirmed: string[]; published: boolean };
  };

  it("Scenario: Owner signs in", async () => {
    sheet.setMarker("confirmed_at", ago(150));
    expect((await signIn("jdoe")).confirmed).toEqual([ID]);
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
    expect(sheet.marker("updated_at")).toBe(NOW_ISO);
    expect(sheet.lastChange()).toMatchObject({
      user: "jdoe",
      marker_id: ID,
      action: "confirm-on-sign-in",
      fields: ["confirmed_at"],
    });
    expect(bucket.writes).toBe(1);
  });

  it("Scenario: Editor signs in", async () => {
    sheet.setMarker("confirmed_at", ago(335));
    expect((await signIn("asmith")).confirmed).toEqual([ID]);
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
  });

  it("Scenario: Old marker", async () => {
    sheet.setMarker("confirmed_at", ago(425));
    expect((await signIn("jdoe")).confirmed).toEqual([]);
    expect(sheet.marker("confirmed_at")).toBe(ago(425));
  });

  it("leaves a never-confirmed marker for a deliberate confirmation", async () => {
    sheet.setMarker("confirmed_at", "");
    expect((await signIn("jdoe")).confirmed).toEqual([]);
    expect(sheet.marker("confirmed_at")).toBe("");
  });

  it("Scenario: Confirmed today", async () => {
    sheet.setMarker("confirmed_at", ago(0.5));
    const changes = sheet.tabs.changes!.length;
    expect((await signIn("jdoe")).confirmed).toEqual([]);
    expect(sheet.tabs.changes!.length).toBe(changes);
    expect(bucket.writes).toBe(0);
  });

  it("Scenario: Admin", async () => {
    sheet.setMarker("confirmed_at", ago(90));
    expect((await signIn("admin:boss")).confirmed).toEqual([]);
    expect(sheet.marker("confirmed_at")).toBe(ago(90));
  });

  it("Scenario: Closed marker (and hidden or deleted ones)", async () => {
    for (const status of ["closed", "hidden", "deleted"]) {
      sheet.setMarker("status", status);
      sheet.setMarker("confirmed_at", ago(90));
      expect((await signIn("jdoe")).confirmed).toEqual([]);
      expect(sheet.marker("confirmed_at")).toBe(ago(90));
    }
  });

  it("confirms nothing for someone with no markers", async () => {
    sheet.setMarker("confirmed_at", ago(90));
    expect((await signIn("stranger")).confirmed).toEqual([]);
  });

  it("needs a signed-in person", async () => {
    expect((await call(undefined, "POST", "/me/confirm-recent")).status).toBe(401);
  });
});

describe("Activity restarts the freshness clock", () => {
  it("Scenario: Owner adds an editor", async () => {
    await call("jdoe", "POST", `/markers/${ID}/editors`, { username: "bob" });
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
  });

  it("restarts when an editor is removed, an owner set, or a transfer offered", async () => {
    await call("jdoe", "DELETE", `/markers/${ID}/editors/asmith`);
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);

    sheet.setMarker("confirmed_at", OLD);
    await call("jdoe", "POST", `/markers/${ID}/transfer`, { username: "bob" });
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);

    sheet.setMarker("confirmed_at", OLD);
    await call("admin:root", "PATCH", `/markers/${ID}`, { version: NOW_ISO, owner: "carol" });
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
  });

  it("Scenario: Admin reactivates a marker", async () => {
    sheet.setMarker("status", "hidden");
    await edit("admin:root", { status: "active" });
    expect(sheet.marker("status")).toBe("active");
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
  });

  it("Scenario: Actions that do not restart the clock", async () => {
    await edit("admin:root", { status: "closed" });
    expect(sheet.marker("confirmed_at")).toBe(OLD);
    await call("admin:root", "PATCH", `/markers/${ID}`, { version: NOW_ISO, status: "hidden" });
    expect(sheet.marker("confirmed_at")).toBe(OLD);
    await call("jdoe", "DELETE", `/markers/${ID}`);
    expect(sheet.marker("confirmed_at")).toBe(OLD);
  });

  it("Scenario: Actions that do not restart the clock (offers)", async () => {
    sheet.tabs.pending!.push([ID, "jdoe", "bob", OLD, "2027-01-01T00:00:00.000Z"]);
    await call("bob", "POST", `/markers/${ID}/transfer/decline`);
    expect(sheet.marker("confirmed_at")).toBe(OLD);
    sheet.tabs.pending!.push([ID, "jdoe", "bob", OLD, "2027-01-01T00:00:00.000Z"]);
    await call("jdoe", "DELETE", `/markers/${ID}/transfer`);
    expect(sheet.marker("confirmed_at")).toBe(OLD);
  });
});

describe("Delete a marker", () => {
  it("Scenario: Owner deletes", async () => {
    const res = await call("jdoe", "DELETE", `/markers/${ID}`);
    expect(res.status).toBe(200);
    expect(sheet.marker("status")).toBe("deleted");
    expect(sheet.marker("name")).toBe("Clinic");
    expect(JSON.parse(bucket.files.get("atlas.json")!.body).markers).toEqual([]);
    expect(sheet.lastChange().action).toBe("delete");
  });

  it("Scenario: Editor tries to delete", async () => {
    expect((await call("asmith", "DELETE", `/markers/${ID}`)).status).toBe(403);
    expect(sheet.marker("status")).toBe("active");
  });

  it("hides a deleted marker from all but admins, who can restore it", async () => {
    await call("jdoe", "DELETE", `/markers/${ID}`);
    expect((await call("jdoe", "GET", `/markers/${ID}`)).status).toBe(404);
    expect((await call("admin:root", "GET", `/markers/${ID}`)).status).toBe(200);
    const res = await call("admin:root", "PATCH", `/markers/${ID}`, {
      version: NOW_ISO,
      status: "active",
    });
    expect(res.status).toBe(200);
    expect(sheet.marker("status")).toBe("active");
  });
});

describe("Marker roles and permissions", () => {
  it("Scenario: Orphaned marker", async () => {
    sheet.tabs.private![1] = [ID, "", "", "", ""];
    expect((await edit("jdoe", { fields: { notes: "x" } })).status).toBe(403);
    expect((await edit("admin:root", { fields: { notes: "x" } })).status).toBe(200);
  });

  it("refuses a stranger everything", async () => {
    const paths: [string, string, unknown?][] = [
      ["GET", `/markers/${ID}`],
      ["PATCH", `/markers/${ID}`, { version: OLD, fields: { notes: "x" } }],
      ["POST", `/markers/${ID}/confirm`],
      ["DELETE", `/markers/${ID}`],
      ["POST", `/markers/${ID}/editors`, { username: "me" }],
      ["DELETE", `/markers/${ID}/editors/asmith`],
      ["POST", `/markers/${ID}/transfer`, { username: "me" }],
      ["DELETE", `/markers/${ID}/transfer`],
    ];
    for (const [method, path, body] of paths) {
      expect((await call("stranger", method, path, body)).status).toBe(403);
    }
    expect(sheet.marker("updated_at")).toBe(OLD);
  });

  it("Scenario: Editor opens the form", async () => {
    const res = await call("asmith", "GET", `/markers/${ID}`);
    const raw = await res.text();
    expect(res.status).toBe(200);
    for (const secret of [SECRET_EMAIL, "J Doe", "jdoe", '"owner"', '"editors"', '"contact"']) {
      expect(raw).not.toContain(secret);
    }
  });

  it("gives the owner the private fields", async () => {
    const res = await call("jdoe", "GET", `/markers/${ID}`);
    expect(await res.json()).toMatchObject({
      role: "owner",
      owner: "jdoe",
      editors: ["asmith"],
      contact: { contact_email: SECRET_EMAIL },
    });
  });

  it("refuses contact details from an editor", async () => {
    const contact = { contact_email: "x@example.org" };
    expect((await edit("asmith", { contact })).status).toBe(403);
    expect(sheet.priv("contact_email")).toBe(SECRET_EMAIL);
  });

  it("Scenario: Admin assigns an orphan", async () => {
    sheet.tabs.private![1] = [ID, "", "", "", ""];
    await edit("admin:root", { owner: "jdoe" });
    expect(sheet.priv("owner")).toBe("jdoe");
    expect(sheet.lastChange().fields).toContainEqual({ field: "owner", from: "", to: "jdoe" });
  });

  it("creates a private row for a marker that has none", async () => {
    sheet.tabs.private!.pop();
    await edit("admin:root", { owner: "jdoe" });
    expect(sheet.priv("id")).toBe(ID);
    expect(sheet.priv("owner")).toBe("jdoe");
  });

  it("Scenario: Username case", async () => {
    sheet.tabs.private![1]![1] = "JDoe";
    expect((await edit("jdoe", { fields: { notes: "x" } })).status).toBe(200);
  });
});

describe("Manage editors", () => {
  const add = (username: string, who = "jdoe") =>
    call(who, "POST", `/markers/${ID}/editors`, { username });

  it("Scenario: Add an editor", async () => {
    expect((await add("Bob")).status).toBe(200);
    expect(sheet.priv("editors")).toBe("asmith,bob");
    expect(sheet.lastChange().fields).toEqual([
      { field: "editors", from: "asmith", to: "asmith,bob" },
    ]);
  });

  it("Scenario: Remove an editor", async () => {
    await call("jdoe", "DELETE", `/markers/${ID}/editors/asmith`);
    expect(text(sheet.priv("editors"))).toBe("");
    expect((await call("asmith", "POST", `/markers/${ID}/confirm`)).status).toBe(403);
  });

  it("Scenario: Owner listed as editor", async () => {
    await add("jdoe");
    await add("ASMITH");
    expect(sheet.priv("editors")).toBe("asmith");
    expect(sheet.marker("confirmed_at")).toBe(OLD);
    expect(bucket.writes).toBe(0);
  });

  it("refuses an ID with separators", async () => {
    expect((await add("a,b")).status).toBe(422);
  });

  it("Scenario: Editor tries to share", async () => {
    expect((await add("bob", "asmith")).status).toBe(403);
  });
});

describe("Transfer ownership", () => {
  const offer = (username = "asmith", who = "jdoe") =>
    call(who, "POST", `/markers/${ID}/transfer`, { username });
  const accept = (who = "asmith") => call(who, "POST", `/markers/${ID}/transfer/accept`);

  it("Scenario: Offer made", async () => {
    expect((await offer()).status).toBe(200);
    expect(sheet.priv("owner")).toBe("jdoe");
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
    const me = (await (await call("asmith", "GET", "/me")).json()) as {
      offers: { marker_id: string; from: string }[];
    };
    expect(me.offers).toMatchObject([{ marker_id: ID, from: "jdoe" }]);
    const form = await (await call("jdoe", "GET", `/markers/${ID}`)).json();
    expect(form).toMatchObject({ offer_to: "asmith" });
  });

  it("Scenario: Offer accepted", async () => {
    await offer();
    sheet.setMarker("confirmed_at", OLD);
    expect((await accept()).status).toBe(200);
    expect(sheet.priv("owner")).toBe("asmith");
    expect(sheet.priv("editors")).toBe("jdoe");
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
    expect(sheet.lastChange()).toMatchObject({
      user: "asmith",
      action: "transfer",
      fields: [{ field: "owner", from: "jdoe", to: "asmith" }],
    });
    expect((await accept()).status).toBe(410);
  });

  it("Scenario: Offer declined", async () => {
    await offer();
    expect((await call("asmith", "POST", `/markers/${ID}/transfer/decline`)).status).toBe(200);
    expect(sheet.priv("owner")).toBe("jdoe");
    expect((await accept()).status).toBe(410);
  });

  it("Scenario: Offer expired or cancelled", async () => {
    sheet.tabs.pending!.push([ID, "jdoe", "asmith", OLD, "2026-11-01T00:00:00.000Z"]);
    expect((await accept()).status).toBe(410);
    expect(sheet.priv("owner")).toBe("jdoe");
    await offer();
    expect((await call("jdoe", "DELETE", `/markers/${ID}/transfer`)).status).toBe(200);
    expect((await accept()).status).toBe(410);
    expect(sheet.priv("owner")).toBe("jdoe");
  });

  it("Scenario: Someone else accepts", async () => {
    await offer();
    expect((await accept("mallory")).status).toBe(403);
    expect((await accept("jdoe")).status).toBe(403);
    expect(sheet.priv("owner")).toBe("jdoe");
  });

  it("Scenario: Ownership changes while an offer is pending", async () => {
    await offer();
    await call("admin:root", "PATCH", `/markers/${ID}`, { version: NOW_ISO, owner: "carol" });
    expect(sheet.priv("owner")).toBe("carol");
    expect((await accept()).status).toBe(410);
  });

  it("ends an offer when the owner is changed in the sheet", async () => {
    await offer();
    sheet.tabs.private![1]![1] = "carol";
    expect((await accept()).status).toBe(410);
  });

  it("allows only one offer at a time", async () => {
    await offer("bob");
    await offer("carol");
    expect((await accept("bob")).status).toBe(403);
    expect((await accept("carol")).status).toBe(200);
  });

  it("refuses offering to the owner, or a marker with no owner", async () => {
    expect((await offer("jdoe")).status).toBe(422);
    sheet.tabs.private![1] = [ID, "", "", "", ""];
    expect((await offer("bob", "admin:root")).status).toBe(409);
  });

  it("Scenario: Pending transfer not published", async () => {
    await offer("carol-the-recipient");
    for (const file of bucket.files.values()) {
      expect(file.body).not.toContain("carol-the-recipient");
    }
  });
});

describe("My markers", () => {
  type Me = {
    username: string;
    admin: boolean;
    markers: { id: string; role: string; status: string; problems?: string[] }[];
  };
  const me = async (who: string) => (await (await call(who, "GET", "/me")).json()) as Me;

  it("Scenario: Owner and editor", async () => {
    expect((await me("jdoe")).markers).toMatchObject([{ id: ID, role: "owner" }]);
    expect((await me("asmith")).markers).toMatchObject([{ id: ID, role: "editor" }]);
    expect((await me("stranger")).markers).toEqual([]);
  });

  it("lists only an admin's own markers, and says they are an admin", async () => {
    const result = await me("admin:root");
    expect(result).toMatchObject({ username: "root", admin: true, markers: [] });
  });

  it("Scenario: Marker failing validation", async () => {
    sheet.setMarker("type", "Hospital");
    expect((await me("jdoe")).markers[0]?.problems).toEqual(["unknown type: Hospital"]);
    const res = await edit("jdoe", { fields: { type: "Clinical" } });
    expect(res.status).toBe(200);
    expect((await me("jdoe")).markers[0]?.problems).toBeUndefined();
  });

  it("Scenario: Closed marker", async () => {
    sheet.setMarker("status", "closed");
    expect((await me("jdoe")).markers).toMatchObject([{ status: "closed" }]);
  });

  it("Close and reopen: Scenario: Owner closes a site", async () => {
    const res = await call("jdoe", "POST", `/markers/${ID}/close`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; marker: { status: string } };
    expect(body.status).toBe("closed");
    expect(body.marker.status).toBe("closed");
    expect(sheet.marker("status")).toBe("closed");
    expect(sheet.marker("confirmed_at")).toBe(OLD);
    expect(sheet.tabs.changes!.at(-1)).toContain("close");
  });

  it("Close and reopen: Scenario: Owner reopens a site", async () => {
    sheet.setMarker("status", "closed");
    const res = await call("jdoe", "POST", `/markers/${ID}/reopen`);
    expect(res.status).toBe(200);
    expect(sheet.marker("status")).toBe("active");
    expect(sheet.marker("confirmed_at")).toBe(NOW_ISO);
    expect(sheet.tabs.changes!.at(-1)).toContain("reopen");
  });

  it("Close and reopen: Scenario: Marker in another status", async () => {
    sheet.setMarker("status", "hidden");
    expect((await call("jdoe", "POST", `/markers/${ID}/close`)).status).toBe(409);
    expect((await call("jdoe", "POST", `/markers/${ID}/reopen`)).status).toBe(409);
    expect(sheet.marker("status")).toBe("hidden");
  });

  it("Scenario: Editor tries to close", async () => {
    expect((await call("asmith", "POST", `/markers/${ID}/close`)).status).toBe(403);
    sheet.setMarker("status", "closed");
    expect((await call("asmith", "POST", `/markers/${ID}/reopen`)).status).toBe(403);
    expect(sheet.marker("status")).toBe("closed");
  });

  it("Still current: Scenario: Closed site", async () => {
    sheet.setMarker("status", "closed");
    expect((await call("jdoe", "POST", `/markers/${ID}/confirm`)).status).toBe(409);
    expect(sheet.marker("confirmed_at")).toBe(OLD);
  });

  it("Scenario: Deleted marker", async () => {
    sheet.setMarker("status", "deleted");
    expect((await me("jdoe")).markers).toEqual([]);
  });

  it("never returns someone else's owner, editors or contact details", async () => {
    const raw = await (await call("asmith", "GET", "/me")).text();
    for (const secret of [SECRET_EMAIL, "J Doe", '"jdoe"']) expect(raw).not.toContain(secret);
  });
});

describe("Publish after Atlas edits", () => {
  it("Scenario: Marker saved", async () => {
    await edit("jdoe", { fields: { name: "Renamed" } });
    expect(JSON.parse(bucket.files.get("atlas.json")!.body).markers[0].name).toBe("Renamed");
  });

  it("Scenario: Publish fails after a save", async () => {
    bucket.failing = true;
    const res = await edit("jdoe", { fields: { name: "Renamed" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ published: false, version: NOW_ISO });
    expect(sheet.marker("name")).toBe("Renamed");
  });

  it("Scenario: Editor change", async () => {
    await call("jdoe", "POST", `/markers/${ID}/editors`, { username: "bob" });
    expect(bucket.writes).toBe(1);
  });

  it("Scenario: No public change", async () => {
    sheet.tabs.pending!.push([ID, "jdoe", "bob", OLD, "2027-01-01T00:00:00.000Z"]);
    await call("bob", "POST", `/markers/${ID}/transfer/decline`);
    expect(bucket.writes).toBe(0);
  });

  it("Scenario: Two saves at once", async () => {
    sheet.tabs.markers!.push(
      sheet.tabs.markers![1]!.map((c, i) => (i === 0 ? "00000000-0000-4000-8000-000000000002" : c)),
    );
    sheet.tabs.private!.push(["00000000-0000-4000-8000-000000000002", "jdoe", "", "", ""]);
    const [a, b] = await Promise.all([
      edit("jdoe", { fields: { name: "A" } }),
      call("jdoe", "PATCH", "/markers/00000000-0000-4000-8000-000000000002", {
        version: OLD,
        fields: { name: "B" },
      }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const names = JSON.parse(bucket.files.get("atlas.json")!.body).markers.map(
      (m: { name: string }) => m.name,
    );
    expect(names).toEqual(["A", "B"]);
  });
});

describe("Private fields stay private", () => {
  it("Scenario: Contact email not published", async () => {
    await edit("jdoe", { fields: { notes: "hello" } });
    for (const file of bucket.files.values()) {
      for (const secret of [SECRET_EMAIL, "J Doe", "asmith"]) {
        expect(file.body).not.toContain(secret);
      }
    }
  });

  it("leaks nothing private in error responses", async () => {
    const cases = [
      await edit("jdoe", { fields: { url: "bad" } }),
      await edit("asmith", { contact: { contact_name: "x" } }),
      await call("stranger", "GET", `/markers/${ID}`),
      await call("stranger", "POST", `/markers/${ID}/transfer/accept`),
    ];
    for (const res of cases) {
      const raw = await res.text();
      expect(raw).not.toContain(SECRET_EMAIL);
      expect(raw).not.toContain("J Doe");
    }
  });
});

describe("Logo upload", () => {
  async function upload(bytes: Buffer, name = "logo.png") {
    const form = new FormData();
    form.set("logo", new File([new Uint8Array(bytes)], name));
    const app = createApp({
      siteUrl: "https://atlas.example.org",
      sheet,
      snapshots: bucket,
      auth: { publishSecret: "s", schedulerEmail: "", audience: "" },
      editing: {
        store: sheet,
        verifyPerson: async () => ({ username: "jdoe", admin: false }),
        logos: {
          async saveLogo(file, body) {
            saved.set(file, body);
            return `https://bucket.example/${file}`;
          },
        },
      },
    });
    return app.request("/api/logos", {
      method: "POST",
      headers: { Authorization: "Bearer x" },
      body: form,
    });
  }
  const picture = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: "red" } });

  it("Scenario: Oversized photo", async () => {
    const res = await upload(await picture(2000, 1000).jpeg().toBuffer(), "photo.jpg");
    expect(res.status).toBe(201);
    const stored = [...saved.values()][0]!;
    const info = await sharp(stored).metadata();
    expect([info.format, info.width, info.height]).toEqual(["webp", 300, 150]);
  });

  it("leaves a small logo at its own size", async () => {
    await upload(await picture(100, 80).png().toBuffer());
    const info = await sharp([...saved.values()][0]!).metadata();
    expect([info.width, info.height]).toEqual([100, 80]);
  });

  it("Scenario: Unsupported file", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"/>');
    expect((await upload(svg, "logo.svg")).status).toBe(422);
    expect((await upload(Buffer.from("not an image"), "logo.png")).status).toBe(422);
    expect((await upload(Buffer.alloc(2 * 1024 * 1024 + 1), "big.png")).status).toBe(422);
    expect(saved.size).toBe(0);
  });
});

it("uses the group name configured for admins", () => {
  expect(ADMIN_GROUP).toBe("atlas-administrators");
});
