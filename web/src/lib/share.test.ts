import { describe, expect, it } from "vitest";
import { badgeSnippet, cardFileName, permalink, shareLinks } from "./share.ts";

const ORIGIN = "https://atlas.openmrs.org";
const ID = "00000000-0000-4000-8000-000000000001";
const marker = { id: ID, name: "Kampala Rollout & Co" };

describe("permalink (Copy link)", () => {
  it("uses the visitor's address", () => {
    expect(permalink(ID, ORIGIN)).toBe(`${ORIGIN}/marker/${ID}`);
    expect(permalink(ID, "https://atlas-stg.openmrs.org/")).toBe(
      `https://atlas-stg.openmrs.org/marker/${ID}`,
    );
  });

  it("encodes an odd id", () => {
    expect(permalink("a/b?c", ORIGIN)).toBe(`${ORIGIN}/marker/a%2Fb%3Fc`);
  });
});

describe("shareLinks (Social networks)", () => {
  const links = shareLinks(marker, ORIGIN);
  const url = encodeURIComponent(`${ORIGIN}/marker/${ID}`);

  it("Scenario: Share on LinkedIn", () => {
    expect(links.linkedin).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`);
  });

  it("Facebook and X", () => {
    expect(links.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${url}`);
    const x = new URL(links.x);
    expect(x.origin + x.pathname).toBe("https://x.com/intent/post");
    expect(x.searchParams.get("url")).toBe(`${ORIGIN}/marker/${ID}`);
    expect(x.searchParams.get("text")).toBe("Kampala Rollout & Co on the OpenMRS Atlas");
  });

  it("Scenario: Share on WhatsApp", () => {
    expect(new URL(links.whatsapp).searchParams.get("text")).toBe(
      `Kampala Rollout & Co on the OpenMRS Atlas ${ORIGIN}/marker/${ID}`,
    );
  });
});

describe("badgeSnippet (Website badge)", () => {
  it("Scenario: Copying the badge snippet", () => {
    expect(badgeSnippet(ID, ORIGIN, "dark")).toBe(
      `<a href="${ORIGIN}/marker/${ID}"><img src="${ORIGIN}/badges/on-the-atlas-dark.svg" alt="On the OpenMRS Atlas" width="200" height="44"></a>`,
    );
  });

  it("Scenario: Snippet is plain HTML", () => {
    const html = badgeSnippet(`"><script>alert(1)</script><x onclick="`, ORIGIN, "light");
    expect(html).not.toMatch(/<script|<iframe|\son\w+=/i);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("a")).toHaveLength(1);
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(doc.body.children).toHaveLength(1);
  });
});

describe("cardFileName (Download the card)", () => {
  it.each([
    ["Kampala Rollout", "kampala-rollout-openmrs-atlas.png"],
    ["Clínica Nuevas Raíces", "clinica-nuevas-raices-openmrs-atlas.png"],
    ["  AMPATH / Moi (Eldoret)!  ", "ampath-moi-eldoret-openmrs-atlas.png"],
    ["Лечебница", "openmrs-atlas-site-openmrs-atlas.png"],
    ["", "openmrs-atlas-site-openmrs-atlas.png"],
  ])("%j → %s", (name, file) => {
    expect(cardFileName(name)).toBe(file);
  });

  it("keeps the slug to 60 characters", () => {
    const slug = cardFileName("a ".repeat(100)).replace("-openmrs-atlas.png", "");
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toMatch(/-$/);
  });
});
