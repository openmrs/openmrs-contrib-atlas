import { describe, expect, it } from "vitest";
import { canonicalFields, checkLimits, checkMarkerRow } from "./input.ts";
import { SEED_LOOKUPS } from "./seed.ts";
import { parseLookups } from "./rows.ts";
import { COLUMNS } from "./schema.ts";

const lookups = parseLookups({
  types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
  distributions: [[...COLUMNS.distributions], ...SEED_LOOKUPS.distributions],
  versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
});
const valid = {
  id: "m1",
  name: "Clinic",
  latitude: 1,
  longitude: 2,
  type: "Clinical",
  status: "active",
};

describe("Field length limits", () => {
  it("Scenario: Name too long", () => {
    expect(checkLimits({ name: "x".repeat(300) })).toEqual([
      { field: "name", reason: "name must be 200 characters or fewer" },
    ]);
  });
  it("checks that a contact email looks like one", () => {
    expect(checkLimits({ contact_email: "nope" })[0]?.field).toBe("contact_email");
    expect(checkLimits({ contact_email: "a@example.org", contact_name: "" })).toEqual([]);
  });
});

describe("Other values (specs/marker-editing)", () => {
  it("Scenario: Too long", () => {
    expect(checkLimits({ distribution: "x".repeat(31) }, lookups)).toEqual([
      { field: "distribution", reason: "distribution must be 30 characters or fewer" },
    ]);
    expect(checkLimits({ openmrs_version: "1234567890123" }, lookups)).toEqual([
      { field: "openmrs_version", reason: "openmrs_version must be 12 characters or fewer" },
    ]);
    expect(
      checkLimits({ distribution: "x".repeat(30), openmrs_version: "2.4.2" }, lookups),
    ).toEqual([]);
  });

  it("never refuses a list entry, however long", () => {
    const long = "A distribution with a very long name indeed";
    const withLong = parseLookups({
      types: [[...COLUMNS.types], ...SEED_LOOKUPS.types],
      distributions: [[...COLUMNS.distributions], [long, ""]],
      versions: [[...COLUMNS.versions], ...SEED_LOOKUPS.versions],
    });
    expect(checkLimits({ distribution: long }, withLong)).toEqual([]);
  });

  it("Scenario: Other value typed like a list entry", () => {
    expect(
      canonicalFields({ distribution: "bahmni", openmrs_version: "2.4.2", name: "x" }, lookups),
    ).toEqual({ distribution: "Bahmni", openmrs_version: "2.4.2", name: "x" });
  });
});

describe("checkMarkerRow", () => {
  it("accepts a valid row, including status deleted", () => {
    expect(checkMarkerRow(valid, lookups).marker?.name).toBe("Clinic");
    expect(checkMarkerRow({ ...valid, status: "deleted" }, lookups).errors).toEqual([]);
  });
  it("ties each reason to its field", () => {
    const { errors } = checkMarkerRow(
      { ...valid, url: "ftp://example.org", type: "Hospital" },
      lookups,
    );
    expect(errors.map((e) => e.field).sort()).toEqual(["type", "url"]);
  });
});
