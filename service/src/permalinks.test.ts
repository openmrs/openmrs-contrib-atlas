import type { PublicMarker } from "@openmrs-atlas/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { createPermalinks, describeMarker } from "./permalinks.ts";
import { FakeBucket, FakeCards, FakeSheet, SECRET_EMAIL } from "./testing.ts";

const SITE = "https://atlas.example.org";
const ID = "00000000-0000-4000-8000-000000000001";
const KAMPALA: PublicMarker = {
  id: ID,
  name: "Kampala Rollout",
  latitude: 0.3476,
  longitude: 32.5825,
  type: "Clinical",
  status: "active",
  country: "UG",
  site_count: 50,
};

function setup(markers: PublicMarker[] = [KAMPALA], withCard = true) {
  const cards = new FakeCards();
  cards.snapshot = { generated_at: "", types: [], distributions: [], versions: [], markers };
  cards.manifest = {
    markers: withCard ? { [ID]: { hash: "abc", file: `cards/${ID}-abc.png` } } : {},
  };
  let clock = 0;
  const app = createPermalinks({ cards, siteUrl: SITE, now: () => clock });
  const get = (path: string) => app.request(path);
  return { cards, get, tick: (ms: number) => (clock += ms) };
}

const meta = (html: string, key: string) =>
  new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)">`).exec(html)?.[1];

describe("Link preview tags", () => {
  it("Scenario: Preview on social media", async () => {
    const res = await setup().get(`/${ID}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=300");
    const html = await res.text();
    expect(meta(html, "og:title")).toBe("Kampala Rollout");
    expect(meta(html, "og:description")).toBe("An OpenMRS implementation in Uganda with 50 sites.");
    expect(meta(html, "og:image")).toBe(`https://storage.example.org/bucket/cards/${ID}-abc.png`);
    expect(meta(html, "og:url")).toBe(`${SITE}/marker/${ID}`);
    expect(meta(html, "twitter:card")).toBe("summary_large_image");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/marker/${ID}">`);
  });

  it("Scenario: Opening a permalink (hands over to the map)", async () => {
    const html = await (await setup().get(`/${ID}`)).text();
    expect(html).toContain(`location.replace("${SITE}/?marker=${ID}")`);
    expect(html).toContain(`<a href="${SITE}/?marker=${ID}">`);
    expect(html).not.toContain("http-equiv");
  });

  it("Scenario: Marker without a card yet", async () => {
    const html = await (await setup([KAMPALA], false).get(`/${ID}`)).text();
    expect(meta(html, "og:image")).toBe("https://storage.example.org/bucket/cards/world.png");
  });

  it("Scenario: Markup in a name", async () => {
    const name = `</script><script>alert("x")</script> & 'Co'`;
    const html = await (await setup([{ ...KAMPALA, name }]).get(`/${ID}`)).text();
    expect(html).not.toContain("<script>alert");
    expect(meta(html, "og:title")).toBe(
      "&lt;/script&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;Co&#39;",
    );
    expect(html.match(/<script>/g)).toHaveLength(1);
  });

  it("Scenario: Closed marker", () => {
    expect(describeMarker({ ...KAMPALA, status: "closed", site_count: undefined })).toBe(
      "A closed OpenMRS implementation in Uganda.",
    );
    expect(describeMarker({ ...KAMPALA, country: undefined, site_count: 1 })).toBe(
      "An OpenMRS implementation.",
    );
  });
});

describe("Unknown permalinks", () => {
  it("Scenario: Deleted marker", async () => {
    const res = await setup([]).get(`/${ID}`);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain(`<meta name="robots" content="noindex">`);
    expect(html).toContain(`location.replace("${SITE}/?marker=${ID}")`);
    expect(meta(html, "og:title")).toBeUndefined();
  });

  it("encodes an odd id in the hand-over", async () => {
    const html = await (await setup([]).get(`/${encodeURIComponent('x"</script>')}`)).text();
    expect(html).not.toContain('x"</script>');
  });
});

describe("Card download address", () => {
  it("Scenario: Download a card", async () => {
    const res = await setup().get(`/${ID}/card.png`);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(
      `https://storage.example.org/bucket/cards/${ID}-abc.png`,
    );
  });

  it("answers 404 without a card or a published marker", async () => {
    expect((await setup([KAMPALA], false).get(`/${ID}/card.png`)).status).toBe(404);
    expect((await setup([]).get(`/${ID}/card.png`)).status).toBe(404);
  });
});

describe("Permalinks read only published data", () => {
  it("Scenario: After a publish (kept in memory for a minute, then read again)", async () => {
    const { cards, get, tick } = setup();
    await get(`/${ID}`);
    await get(`/${ID}/card.png`);
    expect(cards.reads).toBe(1);
    cards.snapshot = { ...cards.snapshot!, markers: [{ ...KAMPALA, name: "Renamed" }] };
    tick(61_000);
    expect(meta(await (await get(`/${ID}`)).text(), "og:title")).toBe("Renamed");
    expect(cards.reads).toBe(2);
  });

  it("Scenario: Nothing private, and no sheet reads, through the whole service", async () => {
    const sheet = new FakeSheet();
    let sheetReads = 0;
    const read = sheet.read.bind(sheet);
    sheet.read = async () => {
      sheetReads++;
      return read();
    };
    const cards = new FakeCards();
    cards.snapshot = {
      generated_at: "",
      types: [],
      distributions: [],
      versions: [],
      markers: [KAMPALA],
    };
    const app = createApp({
      sheet,
      snapshots: new FakeBucket(),
      cards,
      auth: { publishSecret: "s", schedulerEmail: "x@y.z", audience: "a" },
      siteUrl: SITE,
    });
    const res = await app.request(`/marker/${ID}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toContain(SECRET_EMAIL);
    expect(html).not.toMatch(/owner|editor|contact/i);
    expect(sheetReads).toBe(0);
  });
});
