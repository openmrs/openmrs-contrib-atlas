import { describe, expect, it } from "vitest";
import {
  legacyDate,
  migrateAtlas2,
  normaliseVersion,
  ownership,
  type Atlas2Auth,
  type Atlas2Marker,
} from "./migrate.ts";
import { COLUMNS, OTHER_VERSION } from "./schema.ts";
import { SEED_LOOKUPS } from "./seed.ts";
import { parseLookups } from "./rows.ts";
import { validateMarkers } from "./validate.ts";

const versions = SEED_LOOKUPS.versions.map((v) => String(v[0]));
const logoUrl = (id: string) => `https://storage.example/logos/${id}.webp`;

/** Shaped like the 2.0 demo data's Regenstrief row. */
function atlasRow(overrides: Partial<Atlas2Marker> = {}): Atlas2Marker {
  return {
    id: "0f6c52fa-16d7-46a4-a996-ed68110b20df",
    latitude: "39.77864",
    longitude: "-86.17785",
    name: "Regenstrief Institute",
    url: "http://www.regenstrief.org/",
    type: "Research",
    image: null,
    contact: "Burke Mamlin",
    email: "abc@def.com",
    notes: "Burkes site",
    date_created: "2026-07-31 00:00:00",
    date_changed: "2026-08-01 12:30:00",
    created_by: "testadmin",
    openmrs_version: "2.4",
    distribution: 1,
    ...overrides,
  };
}

const distributions = [{ id: 1, name: "OpenMRS 1.x", is_standard: 1 }];
const auth = (atlas_id: string, principal: string, privileges = "ALL", id = 1): Atlas2Auth => ({
  id,
  atlas_id,
  principal,
  privileges,
});

function migrate(atlas: Atlas2Marker[], authRows: Atlas2Auth[] = []) {
  return migrateAtlas2({ atlas, auth: authRows, distributions }, versions, logoUrl);
}

describe("Every marker carried over", () => {
  it("Scenario: Marker count matches", () => {
    const rows = Array.from({ length: 451 }, (_, i) =>
      atlasRow({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
    );
    const result = migrate(rows);
    expect(result.markers).toHaveLength(451);
    expect(result.markers.map((m) => m.id)).toEqual(rows.map((r) => r.id));
    expect(result.markers.every((m) => m.status === "active")).toBe(true);
  });

  it("Scenario: Invalid 2.0 data still imported", () => {
    const result = migrate([atlasRow({ url: "www.moviltech.cl" })]);
    expect(result.markers).toHaveLength(1);
    const lookups = parseLookups({
      types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
      distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
      versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
    });
    const values = [
      [...COLUMNS.markers],
      ...result.markers.map((m) => COLUMNS.markers.map((c) => m[c])),
    ];
    const { problems } = validateMarkers(values, lookups);
    expect(problems[0]?.reasons).toEqual(["url must be an http or https URL"]);
  });
});

describe("Field mapping", () => {
  it("maps dates, distribution and fields", () => {
    const [m] = migrate([atlasRow()]).markers;
    expect(m).toMatchObject({
      name: "Regenstrief Institute",
      latitude: 39.77864,
      longitude: -86.17785,
      distribution: "OpenMRS 1.x",
      created_at: "2026-07-31T00:00:00.000Z",
      updated_at: "2026-08-01T12:30:00.000Z",
      confirmed_at: "2026-08-01T12:30:00.000Z",
      site_count: "",
      logo_url: "",
    });
  });

  it("Scenario: Zero creation date", () => {
    const [m] = migrate([atlasRow({ date_created: "0000-00-00 00:00:00" })]).markers;
    expect(m?.created_at).toBe("2026-08-01T12:30:00.000Z");
  });

  it("Scenario: Contact details stay private", () => {
    const result = migrate([atlasRow()]);
    expect(Object.values(result.markers[0]!)).not.toContain("abc@def.com");
    expect(result.private[0]).toMatchObject({
      contact_name: "Burke Mamlin",
      contact_email: "abc@def.com",
    });
  });

  it("drops counts and module data (no such columns are produced)", () => {
    const [m] = migrate([atlasRow()]).markers;
    expect(Object.keys(m!).sort()).toEqual([...COLUMNS.markers].sort());
  });

  it("returns blank for zero or missing timestamps", () => {
    expect(legacyDate("0000-00-00 00:00:00")).toBe("");
    expect(legacyDate(null)).toBe("");
  });
});

describe("Version normalisation", () => {
  it("Scenario: Patch version", () => {
    expect(normaliseVersion("2.4.2", versions)).toBe("2.4");
  });

  it("Scenario: Unrecognised version", () => {
    expect(normaliseVersion("custom build", versions)).toBe(OTHER_VERSION);
  });

  it("handles the forms found in 2.0 data", () => {
    expect(normaliseVersion("2.4-SNAPSHOT", versions)).toBe("2.4");
    expect(normaliseVersion("1.10.0  Build d8b5d0", versions)).toBe("1.10");
    expect(normaliseVersion("v2.1", versions)).toBe("2.1");
    expect(normaliseVersion("2.11.0", versions)).toBe(OTHER_VERSION);
    expect(normaliseVersion("", versions)).toBe("");
    expect(normaliseVersion("Unknown", versions)).toBe("");
  });

  it("reports unmapped versions", () => {
    const result = migrate([
      atlasRow({ openmrs_version: "custom build" }),
      atlasRow({ id: "b", openmrs_version: "custom build" }),
    ]);
    expect(result.report.unmappedVersions).toEqual({ "custom build": 2 });
  });
});

describe("Owners and editors", () => {
  it("Scenario: Marker with a delegate", () => {
    const m = atlasRow();
    expect(ownership(m, [auth(m.id, "jdoe", "ALL", 1), auth(m.id, "asmith", "ALL", 2)])).toEqual({
      owner: "jdoe",
      editors: ["asmith"],
    });
  });

  it("Scenario: Orphan marker", () => {
    const result = migrate([atlasRow({ created_by: "" })]);
    expect(result.private[0]?.owner).toBe("");
    expect(result.report.orphans).toEqual(["0f6c52fa-16d7-46a4-a996-ed68110b20df"]);
  });

  it("drops module principals and falls back to created_by", () => {
    const m = atlasRow();
    const moduleId = "6f1f3b1e-8a43-4c1e-9b2a-3c4d5e6f7a8b";
    expect(ownership(m, [auth(m.id, moduleId, "ALL")])).toEqual({
      owner: "testadmin",
      editors: [],
    });
  });

  it("writes editors comma-separated and counts distinct owners", () => {
    const a = atlasRow({ id: "a" });
    const b = atlasRow({ id: "b" });
    const result = migrate(
      [a, b],
      [auth("a", "jdoe", "ALL", 1), auth("a", "asmith", "UPDATE", 2), auth("b", "jdoe", "ALL", 3)],
    );
    expect(result.private[0]?.editors).toBe("asmith");
    expect(result.report.owners).toBe(1);
  });
});

describe("Logos carried over", () => {
  it("points logo_url at public storage when a 2.0 image exists", () => {
    const result = migrate([atlasRow({ image: new Uint8Array([1, 2, 3]) })]);
    expect(result.markers[0]?.logo_url).toBe(
      "https://storage.example/logos/0f6c52fa-16d7-46a4-a996-ed68110b20df.webp",
    );
    expect(result.report.logos).toBe(1);
  });
});
