import { describe, expect, it } from "vitest";
import { lookupValues, markerRow, markerValues } from "./fixtures.ts";
import { parseLookups } from "./rows.ts";
import { toIsoDate, validateMarkers } from "./validate.ts";

const lookups = parseLookups(lookupValues);
const validate = (...rows: ReturnType<typeof markerRow>[]) =>
  validateMarkers(markerValues(...rows), lookups);

describe("validateMarkers", () => {
  it("accepts a well-formed row", () => {
    const { markers, problems } = validate(markerRow());
    expect(problems).toEqual([]);
    expect(markers[0]).toMatchObject({
      id: "9f1c2a6e-0d1b-4c3e-9a51-2f7e8b1d0a01",
      latitude: -1.2921,
      type: "Clinical",
      status: "active",
      confirmed_at: "2025-06-01T00:00:00.000Z",
    });
  });

  // Requirement: Required marker fields
  it("Scenario: Missing name", () => {
    const { markers, problems } = validate(markerRow({ name: "" }));
    expect(markers).toEqual([]);
    expect(problems[0]?.reasons).toEqual(["name is required"]);
  });

  it("Scenario: Coordinates out of range", () => {
    const { problems } = validate(markerRow({ latitude: 91, longitude: -181 }));
    expect(problems[0]?.reasons).toEqual([
      "latitude must be between -90 and 90",
      "longitude must be between -180 and 180",
    ]);
  });

  it("reports every missing required field", () => {
    const { problems } = validate(
      markerRow({ id: "", name: "", latitude: "", longitude: "", type: "", status: "" }),
    );
    expect(problems[0]?.reasons).toEqual([
      "id is required",
      "name is required",
      "latitude is required",
      "longitude is required",
      "type is required",
      "status is required",
    ]);
    expect(problems[0]?.markerId).toBeUndefined();
  });

  // Requirement: Field value rules
  it("Scenario: Unknown type", () => {
    const { problems } = validate(markerRow({ type: "Hospital" }));
    expect(problems[0]?.reasons).toEqual(["unknown type: Hospital"]);
  });

  it("Scenario: Blank site count", () => {
    const { markers, problems } = validate(markerRow({ site_count: "" }));
    expect(problems).toEqual([]);
    expect(markers[0]?.site_count).toBeUndefined();
  });

  it("Scenario: Zero site count", () => {
    const { problems } = validate(markerRow({ site_count: 0 }));
    expect(problems[0]?.reasons).toEqual(["site_count must be 1 or more"]);
  });

  it("rejects a fractional site count and keeps a valid one", () => {
    expect(validate(markerRow({ site_count: 2.5 })).problems[0]?.reasons).toEqual([
      "site_count must be a whole number",
    ]);
    expect(validate(markerRow({ site_count: 50 })).markers[0]?.site_count).toBe(50);
  });

  it("checks distribution, version (allowing Other), URLs and status", () => {
    const { problems } = validate(
      markerRow({
        distribution: "Nope",
        openmrs_version: "9.9",
        url: "ftp://example.org",
        logo_url: "not a url",
        status: "deleted",
      }),
    );
    expect(problems[0]?.reasons).toEqual([
      "unknown distribution: Nope",
      "unknown openmrs_version: 9.9",
      "url must be an http or https URL",
      "logo_url must be an http or https URL",
      "unknown status: deleted",
    ]);
    expect(validate(markerRow({ openmrs_version: "Other" })).problems).toEqual([]);
    expect(validate(markerRow({ openmrs_version: "1.10" })).problems).toEqual([]);
  });

  // Requirement: Date fields
  it("Scenario: Date typed into the sheet", () => {
    // 45809 is the Sheets serial number for 2025-06-01.
    const { markers, problems } = validate(markerRow({ confirmed_at: 45809 }));
    expect(problems).toEqual([]);
    expect(markers[0]?.confirmed_at).toBe("2025-06-01T00:00:00.000Z");
  });

  it("Scenario: Unreadable date", () => {
    const { problems } = validate(markerRow({ confirmed_at: "last spring" }));
    expect(problems[0]?.reasons).toEqual(["confirmed_at must be a date"]);
  });

  // Requirement: Marker identifiers
  it("Scenario: Duplicate id", () => {
    const { markers, problems } = validate(markerRow(), markerRow({ name: "Other site" }));
    expect(markers).toEqual([]);
    expect(problems.map((p) => [p.row, p.reasons])).toEqual([
      [2, ["duplicate id"]],
      [3, ["duplicate id"]],
    ]);
  });

  // Requirement: Validation problems are visible to admins
  it("Scenario: Two problems on one row", () => {
    const { problems } = validate(markerRow({ type: "Hospital", url: "not a url" }));
    expect(problems).toEqual([
      {
        markerId: "9f1c2a6e-0d1b-4c3e-9a51-2f7e8b1d0a01",
        row: 2,
        reasons: ["unknown type: Hospital", "url must be an http or https URL"],
      },
    ]);
  });

  it("Scenario: All rows valid", () => {
    expect(validate(markerRow()).problems).toEqual([]);
  });

  it("accepts numeric coordinates entered as text", () => {
    const { markers } = validate(markerRow({ latitude: "-1.5", longitude: "36" }));
    expect(markers[0]).toMatchObject({ latitude: -1.5, longitude: 36 });
  });
});

describe("toIsoDate", () => {
  it("normalises date-only and full ISO text", () => {
    expect(toIsoDate("2025-06-01")).toBe("2025-06-01T00:00:00.000Z");
    expect(toIsoDate("2025-06-01T12:30:00+02:00")).toBe("2025-06-01T10:30:00.000Z");
  });

  it("rejects non-ISO text", () => {
    expect(toIsoDate("06/01/2025")).toBeUndefined();
    expect(toIsoDate("")).toBeUndefined();
  });
});
