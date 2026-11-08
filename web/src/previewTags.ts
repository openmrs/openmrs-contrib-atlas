/** The site's description, as in index.html. */
export const SITE_DESCRIPTION =
  "A world map of OpenMRS implementations. Add your site and find others near you.";

export interface MetaTag {
  tag: "meta";
  attrs: Record<string, string>;
}

/**
 * Open Graph and Twitter/X Card tags for the home page (specs/marker-permalinks, "Home page
 * previews"). Added to builds that know their site and data addresses; none otherwise.
 */
export function previewTags(siteUrl: string | undefined, dataUrl: string | undefined): MetaTag[] {
  if (!siteUrl || !dataUrl) return [];
  const image = `${dataUrl.replace(/\/$/, "")}/cards/world.png`;
  const tags: [string, string, string][] = [
    ["property", "og:type", "website"],
    ["property", "og:site_name", "OpenMRS Atlas"],
    ["property", "og:title", "OpenMRS Atlas"],
    ["property", "og:description", SITE_DESCRIPTION],
    ["property", "og:url", `${siteUrl.replace(/\/$/, "")}/`],
    ["property", "og:image", image],
    ["property", "og:image:width", "1200"],
    ["property", "og:image:height", "630"],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", "OpenMRS Atlas"],
    ["name", "twitter:description", SITE_DESCRIPTION],
    ["name", "twitter:image", image],
  ];
  return tags.map(([attr, key, content]) => ({ tag: "meta", attrs: { [attr]: key, content } }));
}
