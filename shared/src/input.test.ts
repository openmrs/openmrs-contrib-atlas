import { describe, expect, it } from "vitest";
import { checkLimits, checkMarkerRow } from "./input.ts";
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
