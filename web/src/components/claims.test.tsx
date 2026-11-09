import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClaimToReview, Me, MarkerResult, MyClaim } from "../lib/api.ts";
import { ClaimPanel } from "./ClaimPanel.tsx";
import { MyMarkers } from "./MyMarkers.tsx";

/** specs/marker-claims, and claims in My markers (specs/marker-ownership). */

const calls = vi.hoisted(() => ({
  claimMarker: vi.fn(),
  withdrawClaim: vi.fn(),
  approveClaim: vi.fn(),
  declineClaim: vi.fn(),
  track: vi.fn(),
}));
vi.mock("../lib/api.ts", async (original) => ({
  ...(await original<typeof import("../lib/api.ts")>()),
  claimMarker: calls.claimMarker,
  withdrawClaim: calls.withdrawClaim,
  approveClaim: calls.approveClaim,
  declineClaim: calls.declineClaim,
}));
vi.mock("../lib/analytics.ts", () => ({ track: calls.track }));

const RESULT: MarkerResult = { version: "v", status: "active", marker: null, published: true };
const MINE: MyClaim = {
  id: "c1",
  marker_id: "m1",
  name: "Clinic",
  created_at: "2026-11-01T00:00:00Z",
};
const REVIEW: ClaimToReview[] = [
  { ...MINE, username: "asmith", message: "I run the EMR\nat this clinic" },
  { ...MINE, id: "c2", username: "bjones", message: "<b>Ministry</b>" },
];

beforeEach(() => {
  for (const fn of Object.values(calls)) fn.mockReset();
  calls.claimMarker.mockResolvedValue({ claim: { id: "c9" } });
  calls.withdrawClaim.mockResolvedValue({ ok: true });
  calls.approveClaim.mockResolvedValue(RESULT);
  calls.declineClaim.mockResolvedValue({ ok: true });
});

function panel(props: Partial<React.ComponentProps<typeof ClaimPanel>> = {}) {
  const onChanged = vi.fn();
  const onApproved = vi.fn();
  render(
    <ClaimPanel
      markerId="m1"
      claimable={false}
      review={[]}
      onChanged={onChanged}
      onApproved={onApproved}
      {...props}
    />,
  );
  return { onChanged, onApproved };
}

describe("Claim a marker with no owner", () => {
  it("Scenario: Claiming an orphan", async () => {
    const { onChanged } = panel({ claimable: true });
    await userEvent.click(screen.getByRole("button", { name: "Claim this site" }));
    const field = screen.getByLabelText("How are you connected to this site?");
    expect(document.activeElement).toBe(field);
    await userEvent.type(field, "  I lead the EMR team  ");
    expect(screen.getByText(/23 of 1,000 characters/)).toBeTruthy();
    await userEvent.keyboard("{Tab}{Enter}");
    expect(calls.claimMarker).toHaveBeenCalledWith("m1", "I lead the EMR team");
    expect(calls.track).toHaveBeenCalledWith("claim", { marker_id: "m1" });
    expect(onChanged).toHaveBeenCalled();
  });

  it("Scenario: Empty message", async () => {
    panel({ claimable: true });
    await userEvent.click(screen.getByRole("button", { name: "Claim this site" }));
    await userEvent.click(screen.getByRole("button", { name: "Send claim" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "Please say how you are connected to this site.",
    );
    expect(calls.claimMarker).not.toHaveBeenCalled();
    expect(calls.track).not.toHaveBeenCalled();
  });

  it("shows the service's refusal", async () => {
    const { ApiError } = await import("../lib/api.ts");
    calls.claimMarker.mockRejectedValue(new ApiError(429, "You have 10 claims waiting."));
    panel({ claimable: true });
    await userEvent.click(screen.getByRole("button", { name: "Claim this site" }));
    await userEvent.type(screen.getByRole("textbox"), "hi");
    await userEvent.click(screen.getByRole("button", { name: "Send claim" }));
    expect(screen.getByRole("alert").textContent).toBe("You have 10 claims waiting.");
  });

  it("Scenario: Marker with an owner (nothing offered)", () => {
    panel();
    expect(screen.queryByRole("button", { name: "Claim this site" })).toBeNull();
  });
});

describe("Waiting and withdrawing", () => {
  it("Scenario: Second claim on the same marker", async () => {
    const { onChanged } = panel({ mine: MINE, claimable: false });
    expect(screen.getByRole("status").textContent).toBe("Your claim is waiting for an admin.");
    expect(screen.queryByRole("button", { name: "Claim this site" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Withdraw claim" }));
    expect(calls.withdrawClaim).toHaveBeenCalledWith("m1", "c1");
    expect(onChanged).toHaveBeenCalled();
  });
});

describe("Admins review claims", () => {
  it("Scenario: Admin opens a claimed marker", () => {
    panel({ review: REVIEW });
    expect(screen.getByRole("heading", { name: "2 claims to review" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve asmith's claim" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline bjones's claim" })).toBeTruthy();
    // Messages are plain text, never HTML.
    expect(screen.getByText("<b>Ministry</b>")).toBeTruthy();
    expect(document.querySelector(".claim-message b")).toBeNull();
  });

  it("approves in one click", async () => {
    const { onApproved, onChanged } = panel({ review: REVIEW });
    await userEvent.click(screen.getByRole("button", { name: "Approve asmith's claim" }));
    expect(calls.approveClaim).toHaveBeenCalledWith("m1", "c1");
    expect(onApproved).toHaveBeenCalledWith(RESULT);
    expect(onChanged).toHaveBeenCalled();
  });

  it("declines with an optional reason", async () => {
    const { onChanged } = panel({ review: REVIEW });
    await userEvent.click(screen.getByRole("button", { name: "Decline bjones's claim" }));
    const reason = screen.getByLabelText("Reason (optional, sent to bjones)");
    expect(document.activeElement).toBe(reason);
    await userEvent.type(reason, "Ask your country lead");
    await userEvent.click(screen.getByRole("button", { name: "Decline claim" }));
    expect(calls.declineClaim).toHaveBeenCalledWith("m1", "c2", "Ask your country lead");
    expect(onChanged).toHaveBeenCalled();
  });

  it("review takes the place of a claim form", () => {
    panel({ review: REVIEW, claimable: true });
    expect(screen.queryByRole("button", { name: "Claim this site" })).toBeNull();
  });
});

describe("Claims in My markers", () => {
  const me = (fields: Partial<Me>): Me => ({
    username: "bjones",
    admin: false,
    markers: [],
    offers: [],
    ...fields,
  });
  const mine = (m: Me) => {
    const onOpen = vi.fn();
    const onChanged = vi.fn();
    render(
      <MyMarkers
        me={m}
        onOpen={onOpen}
        onResult={() => {}}
        onChanged={onChanged}
        onAdd={() => {}}
        onSignOut={() => {}}
        onClose={() => {}}
      />,
    );
    return { onOpen, onChanged };
  };

  it("Scenario: Pending claim", async () => {
    const { onOpen, onChanged } = mine(me({ claims: [MINE] }));
    expect(screen.getByRole("heading", { name: "Your claims" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Claims to review" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Clinic" }));
    expect(onOpen).toHaveBeenCalledWith("m1");
    await userEvent.click(screen.getByRole("button", { name: "Withdraw your claim for Clinic" }));
    expect(calls.withdrawClaim).toHaveBeenCalledWith("m1", "c1");
    expect(onChanged).toHaveBeenCalled();
  });

  it("Scenario: Admin with claims to review", async () => {
    const { onOpen } = mine(me({ admin: true, review: REVIEW }));
    const section = screen.getByRole("region", { name: "Claims to review" });
    expect(section.textContent).toContain("Claimed by asmith.");
    expect(section.textContent).toContain("Claimed by bjones.");
    // Messages are read on the marker, where the decision is made.
    expect(section.textContent).not.toContain("Ministry");
    await userEvent.click(screen.getAllByRole("button", { name: "Clinic" })[0]!);
    expect(onOpen).toHaveBeenCalledWith("m1");
  });

  it("shows nothing about claims when there are none", () => {
    mine(me({}));
    expect(screen.queryByRole("heading", { name: "Your claims" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Claims to review" })).toBeNull();
  });
});
