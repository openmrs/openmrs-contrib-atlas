/**
 * Writes the "On the OpenMRS Atlas" badges into web/public/badges/, where the site serves them.
 * Run after changing the badge design, the font or the logo, and commit the result:
 *
 *   npm run badges -w service
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BADGE_THEMES, badgeFile, badgeSvg } from "../cards/badge.ts";

export const BADGE_DIR = resolve(import.meta.dirname, "../../../web/public/badges");

mkdirSync(BADGE_DIR, { recursive: true });
for (const theme of BADGE_THEMES) {
  writeFileSync(resolve(BADGE_DIR, badgeFile(theme)), badgeSvg(theme));
  console.log(`wrote ${badgeFile(theme)}`);
}
