import { groupOf, OTHER } from "@openmrs-atlas/shared/lookups";
import type { AtlasSnapshot, PublicMarker } from "./types.ts";

export { OTHER };

/** The distribution and version lists, for telling list values from Other values. */
export interface Lists {
  distributions: ReadonlySet<string>;
  versions: ReadonlySet<string>;
}

export function listsOf(snapshot: AtlasSnapshot | undefined): Lists {
  return {
    distributions: new Set(snapshot?.distributions.map((d) => d.name) ?? []),
    versions: new Set(snapshot?.versions.map((v) => v.version) ?? []),
  };
}

/** The marker's distribution, or `OTHER` when it is not on the list; undefined when blank. */
export const distributionGroup = (m: PublicMarker, lists: Lists) =>
  groupOf(m.distribution, lists.distributions);

/** The marker's version, or `OTHER` when it is not on the list; undefined when blank. */
export const versionGroup = (m: PublicMarker, lists: Lists) =>
  groupOf(m.openmrs_version, lists.versions);
