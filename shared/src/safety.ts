/** A publish may not drop below this share of the markers currently published. */
export const MIN_PUBLISH_RATIO = 0.8;

export type SafetyCheck = { ok: true } | { ok: false; reason: string };

/**
 * Refuses a publish that would shrink the public map sharply, unless forced.
 * See openspec specs/snapshot-publishing, "Publish safety check".
 */
export function checkPublishSafety(
  currentCount: number | undefined,
  newCount: number,
  force: boolean,
): SafetyCheck {
  if (force || !currentCount) return { ok: true };
  if (newCount >= currentCount * MIN_PUBLISH_RATIO) return { ok: true };
  return {
    ok: false,
    reason:
      `publish refused: it would publish ${newCount} markers, fewer than ` +
      `${MIN_PUBLISH_RATIO * 100}% of the ${currentCount} currently published. ` +
      `Fix the sheet, or use Atlas > Force publish if the drop is intended.`,
  };
}
