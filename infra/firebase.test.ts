import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Firebase Hosting config can't read variables, so firebase.json lists one target per
// environment. They must stay identical apart from each environment's Cloud Run service and
// bucket, so a change made to one can't be missed in the other.

type Target = { target: string } & Record<string, unknown>;

const root = new URL("../", import.meta.url);
const firebase = JSON.parse(readFileSync(new URL("firebase.json", root), "utf8")) as {
  hosting: Target[];
};
const firebaserc = JSON.parse(readFileSync(new URL(".firebaserc", root), "utf8")) as {
  projects: Record<string, string>;
  targets: Record<string, { hosting: Record<string, string[]> }>;
};

const ENVIRONMENTS = {
  staging: {
    service: "atlas-service-stg",
    bucket: "openmrs-atlas-stg",
    project: "atlas-stg-513316",
  },
  production: { service: "atlas-service", bucket: "openmrs-atlas", project: "openmrs-atlas" },
};

function target(name: string): Target {
  const found = firebase.hosting.find((t) => t.target === name);
  if (!found) throw new Error(`firebase.json has no ${name} target`);
  return found;
}

/** The target with its environment's service and bucket replaced by placeholders. */
function normalised(name: keyof typeof ENVIRONMENTS): unknown {
  const { service, bucket } = ENVIRONMENTS[name];
  const json = JSON.stringify({ ...target(name), target: "TARGET" })
    .replaceAll(`"serviceId":"${service}"`, `"serviceId":"SERVICE"`)
    .replaceAll(`storage.googleapis.com/${bucket}/`, "storage.googleapis.com/BUCKET/");
  return JSON.parse(json);
}

describe("Firebase hosting targets", () => {
  it("has exactly a staging and a production target", () => {
    expect(firebase.hosting.map((t) => t.target).sort()).toEqual(["production", "staging"]);
  });

  it("differ only in the Cloud Run service and the bucket", () => {
    expect(normalised("production")).toEqual(normalised("staging"));
  });

  it.each(Object.entries(ENVIRONMENTS))("%s points at its own service and bucket", (name, env) => {
    const json = JSON.stringify(target(name));
    expect(json).toContain(`"serviceId":"${env.service}"`);
    const other = Object.entries(ENVIRONMENTS).find(([n]) => n !== name)![1];
    expect(json).not.toContain(`"serviceId":"${other.service}"`);
    expect(json).not.toContain(`storage.googleapis.com/${other.bucket}/`);
  });

  it.each(Object.entries(ENVIRONMENTS))("%s deploys to its own Firebase project", (name, env) => {
    expect(firebaserc.projects[name]).toBe(env.project);
    expect(firebaserc.targets[env.project]?.hosting[name]).toEqual([env.project]);
  });
});
