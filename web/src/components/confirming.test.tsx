import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Me, MarkerResult } from "../lib/api.ts";
import type { PublicMarker } from "../lib/types.ts";
import { MarkerActions } from "./MarkerActions.tsx";
import { MarkerDetails } from "./MarkerDetails.tsx";
import { MyMarkers } from "./MyMarkers.tsx";

const api = vi.hoisted(() => vi.fn());
vi.mock("../lib/api.ts", async (original) => ({
  ...(await original<typeof import("../lib/api.ts")>()),
  api,
}));

const monthsAgo = (months: number, days = 0) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
};

const RESULT: MarkerResult = { version: "v", status: "active", marker: null, published: true };

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue(RESULT);
});

describe("Still current", () => {
  const actions = (confirmedAt: string | undefined, closed = false) =>
    render(
      <MarkerActions
        markerId="m1"
        canManage
        closed={closed}
        confirmedAt={confirmedAt}
        onEdit={() => {}}
        onResult={() => {}}
      />,
    );

  it("Scenario: Recently confirmed marker", () => {
    actions(monthsAgo(3));
    expect(screen.queryByRole("button", { name: "Still current" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });

  it("is not offered a day before 12 months", () => {
    actions(monthsAgo(11, 29));
    expect(screen.queryByRole("button", { name: "Still current" })).toBeNull();
  });

  it("Scenario: Confirming a faded marker", async () => {
    actions(monthsAgo(48));
    await userEvent.click(screen.getByRole("button", { name: "Still current" }));
    expect(api).toHaveBeenCalledWith("/markers/m1/confirm", "POST");
  });

  it("Scenario: Never confirmed", () => {
    actions(undefined);
    expect(screen.getByRole("button", { name: "Still current" })).toBeTruthy();
  });

  it("Scenario: Closed site", () => {
    actions(monthsAgo(48), true);
    expect(screen.queryByRole("button", { name: "Still current" })).toBeNull();
  });
});

describe("My markers: Update", () => {
  const me = (markers: Me["markers"]): Me => ({
    username: "jdoe",
    admin: false,
    email: "jdoe@example.org",
    reminders: true,
    markers,
    offers: [],
  });
  const marker = (id: string, confirmed_at: string, status = "active") => ({
    id,
    name: `Site ${id}`,
    role: "owner" as const,
    status,
    confirmed_at,
  });
  const mine = (m: Me, props: Partial<React.ComponentProps<typeof MyMarkers>> = {}) =>
    render(
      <MyMarkers
        me={m}
        onOpen={() => {}}
        onResult={() => {}}
        onChanged={() => {}}
        onAdd={() => {}}
        onSignOut={() => {}}
        onClose={() => {}}
        {...props}
      />,
    );

  it("Scenario: Update an old marker", async () => {
    const onResult = vi.fn();
    mine(me([marker("a", monthsAgo(20))]), { onResult });
    await userEvent.click(screen.getByRole("button", { name: "Mark Site a still current" }));
    expect(api).toHaveBeenCalledWith("/markers/a/confirm", "POST");
    expect(onResult).toHaveBeenCalledWith("a", RESULT);
  });

  it("Scenario: Recent marker, and closed or hidden ones", () => {
    mine(
      me([
        marker("recent", monthsAgo(2)),
        marker("closed", monthsAgo(30), "closed"),
        marker("hidden", monthsAgo(30), "hidden"),
      ]),
    );
    expect(screen.queryByRole("button", { name: /still current/ })).toBeNull();
  });

  it("offers Update on a never-confirmed active marker", () => {
    mine(me([marker("new", "")]));
    expect(screen.getByRole("button", { name: "Mark Site new still current" })).toBeTruthy();
  });

  it("explains a failure in the panel", async () => {
    const { ApiError } = await import("../lib/api.ts");
    api.mockRejectedValueOnce(new ApiError(409, "This site is closed. Reopen it instead."));
    mine(me([marker("a", monthsAgo(20))]));
    await userEvent.click(screen.getByRole("button", { name: "Mark Site a still current" }));
    expect((await screen.findByRole("alert")).textContent).toContain("closed");
  });

  it("Scenario: Back to the list (focus returns to the entry)", () => {
    mine(me([marker("a", monthsAgo(2)), marker("b", monthsAgo(2))]), { focusId: "b" });
    expect(document.activeElement?.textContent).toBe("Site b");
  });
});

describe("Back to My markers", () => {
  const MARKER: PublicMarker = {
    id: "m1",
    name: "Example Clinic",
    latitude: 0,
    longitude: 0,
    type: "Clinical",
    status: "active",
  };

  it("Scenario: Back to the list", async () => {
    const onBack = vi.fn();
    render(<MarkerDetails marker={MARKER} onClose={() => {}} onBack={onBack} />);
    await userEvent.click(screen.getByRole("button", { name: "Back to My markers" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("Scenario: Backspace back to My markers (and Delete)", async () => {
    const onBack = vi.fn();
    render(<MarkerDetails marker={MARKER} onClose={() => {}} onBack={onBack} />);
    await userEvent.keyboard("{Backspace}");
    await userEvent.keyboard("{Delete}");
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it("Scenario: Backspace while typing", async () => {
    const onBack = vi.fn();
    render(
      <MarkerDetails marker={MARKER} onClose={() => {}} onBack={onBack}>
        <input aria-label="Note" />
      </MarkerDetails>,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Note" }), "ab{Backspace}");
    expect(onBack).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox", { name: "Note" }) as HTMLInputElement).value).toBe("a");
  });

  it("ignores Backspace with a modifier held", async () => {
    const onBack = vi.fn();
    render(<MarkerDetails marker={MARKER} onClose={() => {}} onBack={onBack} />);
    await userEvent.keyboard("{Meta>}{Backspace}{/Meta}");
    expect(onBack).not.toHaveBeenCalled();
  });

  it("Scenario: Opened from the map", async () => {
    render(<MarkerDetails marker={MARKER} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Back to My markers" })).toBeNull();
  });
});
