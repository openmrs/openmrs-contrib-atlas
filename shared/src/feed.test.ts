// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { FEED_ITEMS, toRss } from "./feed.ts";
import { lookupValues, markerRow, markerValues } from "./fixtures.ts";
import { parseLookups } from "./rows.ts";
import { COLUMNS, type Cell } from "./schema.ts";
import { buildSnapshot } from "./snapshot.ts";
import { validateMarkers } from "./validate.ts";

const SITE = "https://atlas.example.org";
const A = "9f1c2a6e-0d1b-4c3e-9a51-2f7e8b1d0a01";
const B = "9f1c2a6e-0d1b-4c3e-9a51-2f7e8b1d0a02";
const lookups = parseLookups(lookupValues);
const snapshot = (() => {
  const { markers } = validateMarkers(
    markerValues(
      markerRow({ id: A, name: "Eldoret Clinic & Co" }),
      markerRow({ id: B, name: "Gone Clinic", status: "deleted" }),
    ),
    lookups,
  );
  return buildSnapshot(markers, lookups, new Date("2026-11-03T12:00:00Z"));
})();

function log(...rows: [string, string, string, string, unknown[]][]): Cell[][] {
  return [
    [...COLUMNS.changes],
    ...rows.map(([at, user, id, action, fields]) => [at, user, id, action, JSON.stringify(fields)]),
  ];
}

function items(rss: string) {
  const doc = new DOMParser().parseFromString(rss, "application/xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return [...doc.querySelectorAll("item")].map((item) => ({
    title: item.querySelector("title")?.textContent,
    link: item.querySelector("link")?.textContent,
    guid: item.querySelector("guid")?.textContent,
  }));
}

describe("RSS feed at /rss", () => {
  it("Scenario: New marker in the feed", () => {
    const rss = toRss(
      snapshot,
      log(["2026-11-03T10:00:00.000Z", "jdoe", A, "add", ["name"]]),
      SITE,
    );
    expect(items(rss)).toEqual([
      {
        title: "Eldoret Clinic & Co joins the Atlas",
        link: `${SITE}/?marker=${A}`,
        guid: `${A}/add/2026-11-03T10:00:00.000Z`,
      },
    ]);
  });

  it("titles each kind of change, newest first", () => {
    const rss = toRss(
      snapshot,
      log(
        ["2026-11-01T00:00:00.000Z", "a", A, "add", []],
        ["2026-11-02T00:00:00.000Z", "a", A, "edit", ["url"]],
        ["2026-11-03T00:00:00.000Z", "a", A, "confirm", ["confirmed_at"]],
        ["2026-11-04T00:00:00.000Z", "a", A, "close", ["status"]],
        ["2026-11-05T00:00:00.000Z", "a", A, "reopen", ["status", "confirmed_at"]],
        ["2026-11-06T00:00:00.000Z", "a", A, "edit", []],
      ),
      SITE,
    );
    expect(items(rss).map((i) => i.title)).toEqual([
      "Eldoret Clinic & Co confirmed as still current",
      "Eldoret Clinic & Co has reopened",
      "Eldoret Clinic & Co has closed",
      "Eldoret Clinic & Co confirmed as still current",
      "Eldoret Clinic & Co entry updated",
      "Eldoret Clinic & Co joins the Atlas",
    ]);
  });

  it("is well-formed RSS 2.0 with the channel elements feed readers need", () => {
    const rss = toRss(snapshot, log(), SITE);
    const doc = new DOMParser().parseFromString(rss, "application/xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.getAttribute("version")).toBe("2.0");
    for (const tag of ["title", "link", "description"]) {
      expect(doc.querySelector(`channel > ${tag}`)?.textContent).toBeTruthy();
    }
  });

  it(`keeps only the newest ${FEED_ITEMS} items`, () => {
    const rows = Array.from({ length: 80 }, (_, i): [string, string, string, string, unknown[]] => [
      new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      "a",
      A,
      "edit",
      ["url"],
    ]);
    expect(items(toRss(snapshot, log(...rows), SITE))).toHaveLength(FEED_ITEMS);
  });
});

describe("The feed holds public data only", () => {
  it("Scenario: Who made a change", () => {
    const rss = toRss(
      snapshot,
      log(["2026-11-03T10:00:00.000Z", "asmith-editor", A, "edit", ["url", "notes"]]),
      SITE,
    );
    expect(rss).not.toContain("asmith-editor");
    expect(rss).not.toContain("notes");
  });

  it("Scenario: Private change only", () => {
    const rss = toRss(
      snapshot,
      log(
        ["2026-11-03T10:00:00.000Z", "a", A, "edit", [{ field: "editors", from: "", to: "b" }]],
        ["2026-11-03T11:00:00.000Z", "a", A, "edit", ["contact_email"]],
        ["2026-11-03T12:00:00.000Z", "a", A, "transfer", [{ field: "owner", from: "a", to: "b" }]],
        // Claims and their decisions are private (specs/marker-claims).
        ["2026-11-03T12:01:00.000Z", "b", A, "claim", [{ claim: "c1" }]],
        ["2026-11-03T12:02:00.000Z", "b", A, "claim-withdraw", [{ claim: "c1" }]],
        ["2026-11-03T12:03:00.000Z", "r", A, "claim-decline", [{ claim: "c2" }]],
        [
          "2026-11-03T12:04:00.000Z",
          "r",
          A,
          "claim-approve",
          [{ claim: "c3" }, { field: "owner", from: "", to: "b" }],
        ],
      ),
      SITE,
    );
    expect(items(rss)).toEqual([]);
  });

  it("Scenario: Deleted marker", () => {
    const rss = toRss(snapshot, log(["2026-11-03T10:00:00.000Z", "a", B, "add", []]), SITE);
    expect(items(rss)).toEqual([]);
  });
});
