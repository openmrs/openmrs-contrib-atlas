import type { PublicMarker } from "./types.ts";

/** How a marker was shared, as recorded by the `share` analytics event. */
export type ShareMethod =
  | "copy_link"
  | "linkedin"
  | "facebook"
  | "x"
  | "whatsapp"
  | "native"
  | "badge_copy"
  | "image_download";

/** Where the Share dialog was opened from. */
export type ShareSource = "details" | "prompt" | "email";

export type BadgeTheme = "light" | "dark";
export const BADGE_WIDTH = 200;
export const BADGE_HEIGHT = 44;
export const BADGE_ALT = "On the OpenMRS Atlas";

/** The marker's permalink on the address the visitor is using (specs/marker-sharing, "Copy link"). */
export function permalink(id: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/marker/${encodeURIComponent(id)}`;
}

export const shareText = (marker: Pick<PublicMarker, "name">) =>
  `${marker.name} on the OpenMRS Atlas`;

export type Network = "linkedin" | "facebook" | "x" | "whatsapp";
export const NETWORKS: { id: Network; label: string }[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "whatsapp", label: "WhatsApp" },
];

/** Each network's own share page, as a plain link: nothing is loaded from the networks. */
export function shareLinks(
  marker: Pick<PublicMarker, "id" | "name">,
  origin: string,
): Record<Network, string> {
  const url = encodeURIComponent(permalink(marker.id, origin));
  const text = encodeURIComponent(shareText(marker));
  return {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://x.com/intent/post?url=${url}&text=${text}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
  };
}

export const badgeUrl = (origin: string, theme: BadgeTheme) =>
  `${origin.replace(/\/$/, "")}/badges/on-the-atlas-${theme}.svg`;

const attr = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`,
  );

/** The website badge as plain HTML: a link around an image, with no script or iframe. */
export function badgeSnippet(id: string, origin: string, theme: BadgeTheme): string {
  return (
    `<a href="${attr(permalink(id, origin))}">` +
    `<img src="${attr(badgeUrl(origin, theme))}" alt="${BADGE_ALT}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}">` +
    `</a>`
  );
}

/** "Clínica Nuevas Raíces" → "clinica-nuevas-raices-openmrs-atlas.png". */
export function cardFileName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return `${slug || "openmrs-atlas-site"}-openmrs-atlas.png`;
}
