import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicMarker } from "../lib/types.ts";
import { MarkerDetails } from "./MarkerDetails.tsx";
import { ShareDialog } from "./ShareDialog.tsx";

const track = vi.hoisted(() => vi.fn());
vi.mock("../lib/analytics.ts", () => ({ track }));
const saveBlob = vi.hoisted(() => vi.fn());
vi.mock("../export/download.ts", () => ({ saveBlob }));

const ORIGIN = "https://atlas.openmrs.org";
const ID = "00000000-0000-4000-8000-000000000001";
const KAMPALA: PublicMarker = {
  id: ID,
  name: "Kampala Rollout",
  latitude: 0.35,
  longitude: 32.58,
  type: "Clinical",
  status: "active",
  country: "UG",
  site_count: 50,
};

let writeText: ReturnType<typeof vi.fn>;
function stubClipboard(impl: (text: string) => Promise<void> = async () => {}) {
  writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

function open(props: Partial<React.ComponentProps<typeof ShareDialog>> = {}) {
  const onClose = vi.fn();
  const user = userEvent.setup();
  stubClipboard();
  render(
    <ShareDialog marker={KAMPALA} source="details" origin={ORIGIN} onClose={onClose} {...props} />,
  );
  return { user, onClose };
}

beforeEach(() => {
  track.mockReset();
  saveBlob.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "share");
});

describe("Share dialog", () => {
  it("is titled with the marker's name and offers everything, in order", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Share Kampala Rollout" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labels = [...dialog.querySelectorAll("img.share-card, button, a")].map(
      (el) => el.getAttribute("alt") ?? el.textContent,
    );
    expect(labels).toEqual([
      "×",
      "Kampala Rollout on the OpenMRS Atlas",
      "Copy link",
      "LinkedIn",
      "Facebook",
      "X",
      "WhatsApp",
      "Copy code",
      "Download image",
    ]);
  });

  it("Scenario: Marker without a card yet", () => {
    open();
    fireEvent.error(screen.getByAltText("Kampala Rollout on the OpenMRS Atlas"));
    expect(screen.queryByAltText("Kampala Rollout on the OpenMRS Atlas")).toBeNull();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  });

  it("keeps Tab inside the dialog", async () => {
    const { user } = open();
    expect(document.activeElement?.textContent).toBe("Copy link");
    screen.getByRole("button", { name: "Download image" }).focus();
    await user.tab();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
    await user.tab({ shift: true });
    expect(document.activeElement?.textContent).toBe("Download image");
  });

  it("closes from the Close button and by clicking outside", async () => {
    const { user, onClose } = open();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(document.querySelector(".share-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("Scenario: Closing the dialog", () => {
  function Harness() {
    const [sharing, setSharing] = React.useState(false);
    const [detailsOpen, setDetailsOpen] = React.useState(true);
    return (
      <>
        {detailsOpen && (
          <MarkerDetails
            marker={KAMPALA}
            onClose={() => setDetailsOpen(false)}
            onBack={() => setDetailsOpen(false)}
            onShare={() => setSharing(true)}
          />
        )}
        {sharing && (
          <ShareDialog
            marker={KAMPALA}
            source="details"
            origin={ORIGIN}
            onClose={() => setSharing(false)}
          />
        )}
      </>
    );
  }

  it("Escape closes only the dialog, and focus returns to Share", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const share = screen.getByRole("button", { name: "Share" });
    await user.click(share);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.keyboard("{Backspace}");
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("complementary", { name: "Details for Kampala Rollout" })).toBeTruthy();
    expect(document.activeElement).toBe(share);
  });
});

describe("Copy link", () => {
  it("Scenario: Copying the link", async () => {
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(`${ORIGIN}/marker/${ID}`);
    expect(screen.getByRole("status").textContent).toBe("Link copied");
    expect(track).toHaveBeenCalledWith("share", {
      method: "copy_link",
      source: "details",
      marker_id: ID,
    });
  });

  it("leaves the link selected when the browser won't copy", async () => {
    const { user } = open();
    stubClipboard(async () => {
      throw new Error("denied");
    });
    await user.click(screen.getByRole("button", { name: "Copy link" }));
    const field = screen.getByRole("textbox", { name: "Link" }) as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe(`${ORIGIN}/marker/${ID}`);
    expect(screen.getByRole("status").textContent).toMatch(/^Press (⌘C|Ctrl\+C) to copy\.$/);
  });
});

describe("Social networks", () => {
  it("are plain links to each network's share page, in a new tab", async () => {
    const { user } = open();
    const linkedin = screen.getByRole("link", { name: "LinkedIn" });
    expect(linkedin.getAttribute("href")).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${ORIGIN}/marker/${ID}`)}`,
    );
    for (const name of ["LinkedIn", "Facebook", "X", "WhatsApp"]) {
      const a = screen.getByRole("link", { name });
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
    linkedin.addEventListener("click", (e) => e.preventDefault());
    await user.click(linkedin);
    expect(track).toHaveBeenCalledWith("share", expect.objectContaining({ method: "linkedin" }));
  });

  it("Scenario: Nothing loaded from the networks", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    open();
    const sources = [...document.querySelectorAll("[src]")].map((el) => el.getAttribute("src")!);
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) expect(src.startsWith("/") || src.startsWith(ORIGIN)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("Device share sheet", () => {
  it("Scenario: Desktop without a share sheet", () => {
    open();
    expect(screen.queryByRole("button", { name: "More options…" })).toBeNull();
  });

  it("Scenario: Phone with a share sheet (cancelling shows no error)", async () => {
    const share = vi.fn().mockRejectedValueOnce(new DOMException("cancelled", "AbortError"));
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "More options…" }));
    expect(share).toHaveBeenCalledWith({
      title: "Kampala Rollout",
      text: "Kampala Rollout on the OpenMRS Atlas",
      url: `${ORIGIN}/marker/${ID}`,
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(track).toHaveBeenCalledWith("share", expect.objectContaining({ method: "native" }));
  });
});

describe("Website badge", () => {
  it("Scenario: Copying the badge snippet", async () => {
    const { user } = open();
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    const html = writeText.mock.calls[0]![0] as string;
    expect(html).toContain(`<a href="${ORIGIN}/marker/${ID}">`);
    expect(html).toContain(`src="${ORIGIN}/badges/on-the-atlas-dark.svg"`);
    expect(html).toContain('alt="On the OpenMRS Atlas"');
    expect(screen.getByRole("status").textContent).toBe("Code copied");
    expect(track).toHaveBeenCalledWith("share", expect.objectContaining({ method: "badge_copy" }));
  });

  it("previews both badges", () => {
    open();
    const imgs = [...document.querySelectorAll(".badge-choice img")].map((i) =>
      i.getAttribute("src"),
    );
    expect(imgs).toEqual([
      `${ORIGIN}/badges/on-the-atlas-light.svg`,
      `${ORIGIN}/badges/on-the-atlas-dark.svg`,
    ]);
  });
});

describe("Download the card", () => {
  it("Scenario: Downloading a card", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const fetch = vi.fn().mockResolvedValue(new Response(blob, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Download image" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(`/marker/${ID}/card.png`);
    expect(saveBlob.mock.calls[0]![1]).toBe("kampala-rollout-openmrs-atlas.png");
    expect(track).toHaveBeenCalledWith(
      "share",
      expect.objectContaining({ method: "image_download" }),
    );
  });

  it("Scenario: Card not drawn yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Download image" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The image isn't ready yet. Try again in a few minutes.",
    );
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it("says so when the download fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Download image" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The image couldn't be downloaded.",
    );
  });
});

describe("Share from marker details", () => {
  it("Scenario: Closed site (and anyone may share)", async () => {
    const onShare = vi.fn();
    render(
      <MarkerDetails
        marker={{ ...KAMPALA, status: "closed" }}
        onClose={() => {}}
        onShare={onShare}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(onShare).toHaveBeenCalled();
  });
});
