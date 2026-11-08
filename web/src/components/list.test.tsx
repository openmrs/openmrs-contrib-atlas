import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ListSort } from "../lib/list.ts";
import type { PublicMarker } from "../lib/types.ts";
import { MarkerDetails } from "./MarkerDetails.tsx";
import { SiteList } from "./SiteList.tsx";

const m = (fields: Partial<PublicMarker> & { id: string; name: string }): PublicMarker => ({
  latitude: 0,
  longitude: 0,
  type: "Clinical",
  status: "active",
  ...fields,
});

const MARKERS = [
  m({
    id: "a",
    name: "Kampala Rollout",
    country: "UG",
    site_count: 12,
    confirmed_at: "2026-03-15T00:00:00Z",
  }),
  m({ id: "b", name: "Old Clinic", status: "closed" }),
];

function list(props: Partial<React.ComponentProps<typeof SiteList>> = {}) {
  const handlers = { onSortChange: vi.fn(), onOpen: vi.fn(), onClose: vi.fn() };
  render(<SiteList markers={MARKERS} sort="name" {...handlers} {...props} />);
  return handlers;
}

describe("List of markers in view", () => {
  it("counts the markers in view", () => {
    list();
    expect(screen.getByRole("heading").textContent).toBe("2 implementations in view");
  });

  it("Scenario: Nothing in view", () => {
    list({ markers: [] });
    expect(screen.getByRole("heading").textContent).toBe("0 implementations in view");
    expect(screen.getByText(/Zoom out or move the map, or clear the filters/)).toBeTruthy();
  });

  it("closes with Escape and with ×", async () => {
    const { onClose } = list();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close list" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("List entries", () => {
  it("Scenario: Entry content", () => {
    list();
    const entry = screen.getByRole("button", { name: /^Kampala Rollout/ });
    expect(entry.textContent).toBe("Kampala RolloutUganda · Clinical · 12 sites · Mar 2026");
  });

  it("Scenario: Closed site in the list", () => {
    list();
    const entry = screen.getByRole("button", { name: /^Old Clinic/ });
    expect(within(entry).getByText("Closed")).toBeTruthy();
  });
});

describe("Sorting the list", () => {
  it("offers name, country, sites and last confirmed", async () => {
    const { onSortChange } = list();
    const select = screen.getByRole("combobox", { name: "Sort by" }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual([
      "Name",
      "Country",
      "Sites",
      "Last confirmed",
    ]);
    await userEvent.selectOptions(select, "Sites");
    expect(onSortChange).toHaveBeenCalledWith("sites" satisfies ListSort);
  });
});

describe("Opening a marker from the list", () => {
  it("Scenario: Open from the list", async () => {
    const { onOpen } = list();
    await userEvent.click(screen.getByRole("button", { name: /^Old Clinic/ }));
    expect(onOpen).toHaveBeenCalledWith(MARKERS[1]);
  });

  it("Scenario: Keyboard-only visitor", async () => {
    const { onOpen } = list();
    screen.getByRole("button", { name: /^Kampala Rollout/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith(MARKERS[0]);
  });
});

describe("Back to the list", () => {
  it("focuses the entry the person came back from", () => {
    list({ focusId: "b" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Old Clinic/ }));
  });

  it("Scenario: Back with the control (labelled for the list)", async () => {
    const onBack = vi.fn();
    render(
      <MarkerDetails
        marker={MARKERS[0]!}
        onClose={() => {}}
        onBack={onBack}
        backLabel="Back to the list"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Back to the list" }));
    await userEvent.keyboard("{Backspace}");
    expect(onBack).toHaveBeenCalledTimes(2);
  });
});
