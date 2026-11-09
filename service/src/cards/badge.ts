import { cardFonts, textPath, textWidth } from "./text.ts";
import { logoHref } from "./card.ts";

export type BadgeTheme = "light" | "dark";
export const BADGE_THEMES: readonly BadgeTheme[] = ["light", "dark"];
export const BADGE_WIDTH = 200;
export const BADGE_HEIGHT = 44;
export const badgeFile = (theme: BadgeTheme) => `on-the-atlas-${theme}.svg`;

const THEMES: Record<BadgeTheme, { background: string; border?: string; ink: string }> = {
  light: { background: "#ffffff", border: "#d9dee4", ink: "#1f2933" },
  dark: { background: "#00463f", ink: "#ffffff" },
};

/**
 * "On the OpenMRS Atlas", for implementations' own websites (specs/marker-sharing, "Badge
 * files"). The text is drawn as outlines and the cross is inlined, so the file loads nothing
 * else and looks the same in every browser.
 */
export function badgeSvg(theme: BadgeTheme): string {
  const { regular, bold } = cardFonts();
  const t = THEMES[theme];
  const w = BADGE_WIDTH;
  const h = BADGE_HEIGHT;
  const textX = 46;
  // Fit "OpenMRS Atlas" to the space right of the cross, up to 17px.
  const size = Math.min(17, (17 * (w - textX - 12)) / textWidth(bold, "OpenMRS Atlas", 17));
  const border = t.border
    ? `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="7.5" fill="${t.background}" stroke="${t.border}"/>`
    : `<rect width="${w}" height="${h}" rx="8" fill="${t.background}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="On the OpenMRS Atlas">`,
    `<title>On the OpenMRS Atlas</title>`,
    border,
    `<image href="${logoHref()}" x="9" y="8" width="28" height="28"/>`,
    `<path fill="${t.ink}" fill-opacity="0.8" d="${textPath(regular, "On the", textX, 18, 11)}"/>`,
    `<path fill="${t.ink}" d="${textPath(bold, "OpenMRS Atlas", textX, 35, size)}"/>`,
    `</svg>`,
    "",
  ].join("\n");
}
