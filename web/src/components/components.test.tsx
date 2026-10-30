import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import fixture from "../../e2e/static/atlas.json";
import { legendEntries, palette } from "../lib/colours.ts";
import type { AtlasSnapshot, PublicMarker } from "../lib/types.ts";
import { Legend } from "./Legend.tsx";
import { MarkerDetails } from "./MarkerDetails.tsx";
import { SearchBox } from "./SearchBox.tsx";

const snapshot = fixture as AtlasSnapshot;
const byName = (name: string) => snapshot.markers.find((m) => m.name === name)!;

describe("MarkerDetails", () => {
  it("Scenario: Popup content", () => {
    const marker: PublicMarker = {
      id: "m1",
      name: "Example Clinic",
      latitude: 0,
      longitude: 0,
      type: "Clinical",
      url: "https://example.org",
      notes: "Open weekdays",
      confirmed_at: "2025-06-01T00:00:00.000Z",
    };
    const { container } = render(<MarkerDetails marker={marker} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Example Clinic" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Website" }).getAttribute("href")).toBe(
      "https://example.org",
    );
    expect(screen.getByText("Open weekdays")).toBeTruthy();
    expect(screen.getByText("June 2025")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("Distribution")).toBeNull();
  });

  it("Scenario: Markup in notes", () => {
    const marker = byName("Nairobi Teaching Hospital");
    const { container } = render(<MarkerDetails marker={marker} onClose={() => {}} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector(".notes")?.textContent).toContain(
      "<script>window.hacked = true</script>",
    );
    expect(screen.getByRole("link", { name: "https://example.org/about" })).toBeTruthy();
  });

  it("shows site count only above 1 and closes on Escape", async () => {
    const onClose = vi.fn();
    render(<MarkerDetails marker={byName("Kampala Rollout")} onClose={onClose} />);
    expect(screen.getByText("50")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Legend", () => {
  it("Scenario: Switch to distribution", async () => {
    const onChange = vi.fn();
    const colours = palette(snapshot, "distribution");
    render(
      <Legend
        colourBy="distribution"
        entries={legendEntries(snapshot.markers, "distribution", colours)}
        onColourByChange={onChange}
      />,
    );
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toContain("Unknown");
    await userEvent.selectOptions(screen.getByRole("combobox"), "version");
    expect(onChange).toHaveBeenCalledWith("version");
  });
});

describe("SearchBox", () => {
  it("picks a result with the keyboard", async () => {
    const onPick = vi.fn();
    render(<SearchBox markers={snapshot.markers} onPick={onPick} />);
    await userEvent.type(screen.getByRole("combobox"), "Uganda");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith(byName("Makerere Research Clinic"));
  });
});
