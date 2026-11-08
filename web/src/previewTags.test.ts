import { describe, expect, it } from "vitest";
import { previewTags } from "./previewTags.ts";

const content = (tags: ReturnType<typeof previewTags>, key: string) =>
  tags.find((t) => t.attrs.property === key || t.attrs.name === key)?.attrs.content;

describe("Home page previews", () => {
  it("Scenario: Sharing the home page", () => {
    const tags = previewTags("https://atlas.example.org", "https://storage.example.org/b");
    expect(content(tags, "og:title")).toBe("OpenMRS Atlas");
    expect(content(tags, "og:image")).toBe("https://storage.example.org/b/cards/world.png");
    expect(content(tags, "og:url")).toBe("https://atlas.example.org/");
    expect(content(tags, "twitter:card")).toBe("summary_large_image");
  });

  it("adds nothing to builds without a site or data address", () => {
    expect(previewTags(undefined, "https://storage.example.org/b")).toEqual([]);
    expect(previewTags("https://atlas.example.org", undefined)).toEqual([]);
  });
});
