import { describe, expect, it } from "vitest";
import { can, isUsername, roleOn, type Action, type Role } from "./permissions.ts";

const person = (username: string, admin = false) => ({ username, admin });

describe("Role permissions", () => {
  const table: [Action, Role[]][] = [
    ["edit", ["editor", "owner", "admin"]],
    ["confirm", ["editor", "owner", "admin"]],
    ["delete", ["owner", "admin"]],
    ["contact", ["owner", "admin"]],
    ["manage-editors", ["owner", "admin"]],
    ["transfer", ["owner", "admin"]],
    ["set-owner", ["admin"]],
    ["set-status", ["admin"]],
  ];
  it.each(table)("%s is allowed for %j", (action, allowed) => {
    for (const role of ["editor", "owner", "admin"] as Role[]) {
      expect(can(role, action)).toBe(allowed.includes(role));
    }
    expect(can(undefined, action)).toBe(false);
  });
});

describe("roleOn", () => {
  const row = { owner: "JDoe", editors: ["asmith"] };
  it("Scenario: Username case", () => {
    expect(roleOn(person("jdoe"), row)).toBe("owner");
  });
  it("finds editors and strangers", () => {
    expect(roleOn(person("ASmith"), row)).toBe("editor");
    expect(roleOn(person("other"), row)).toBeUndefined();
  });
  it("Scenario: Orphaned marker", () => {
    expect(roleOn(person("jdoe"), { editors: [] })).toBeUndefined();
    expect(roleOn(person("jdoe"), undefined)).toBeUndefined();
    expect(roleOn(person("root", true), undefined)).toBe("admin");
  });
});

describe("isUsername", () => {
  it("accepts OpenMRS IDs and refuses separators", () => {
    expect(isUsername("a.smith-2")).toBe(true);
    expect(isUsername("a,b")).toBe(false);
    expect(isUsername("a b")).toBe(false);
    expect(isUsername("")).toBe(false);
  });
});
