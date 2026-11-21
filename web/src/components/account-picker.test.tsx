import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountPicker } from "./AccountPicker.tsx";

/** specs/account-lookup: Suggestions in OpenMRS ID fields. */

const search = vi.hoisted(() => vi.fn());
vi.mock("../lib/api.ts", async (original) => ({
  ...(await original<typeof import("../lib/api.ts")>()),
  searchAccounts: search,
}));

beforeEach(() => {
  search.mockReset();
  // Keycloak's answer for "burke": a last-name match first, then the username.
  search.mockResolvedValue([
    { username: "mercedesburke", name: "Mercedes Burke" },
    { username: "burke", name: "Burke Mamlin" },
  ]);
});

/** The picker in a parent that owns its value, as the forms do. */
function Field({
  start = "",
  onPick = () => {},
}: {
  start?: string;
  onPick?: (u: string) => void;
}) {
  const [value, setValue] = useState(start);
  return (
    <AccountPicker
      label="Owner"
      value={value}
      onChange={(u) => {
        setValue(u);
        onPick(u);
      }}
    />
  );
}

const options = async () => {
  const list = await screen.findByRole("listbox", {}, { timeout: 2000 });
  return [...list.querySelectorAll("[role=option] .result-name")].map((o) => o.textContent);
};

describe("Suggestions in OpenMRS ID fields", () => {
  it("Scenario: Typing an exact OpenMRS ID", async () => {
    const picked = vi.fn();
    render(<Field onPick={picked} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Owner" }), "Burke");
    expect(await options()).toEqual(["burke", "mercedesburke"]);
    // Enter keeps the person whose ID was typed.
    await userEvent.keyboard("{Enter}");
    expect(picked).toHaveBeenLastCalledWith("burke");
  });

  it("suggests everyone who matches part of a name", async () => {
    render(<Field />);
    await userEvent.type(screen.getByRole("combobox", { name: "Owner" }), "burk");
    expect(await options()).toEqual(["mercedesburke", "burke"]);
  });

  it("Scenario: Owner field already filled", async () => {
    render(<Field start="burke" />);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();

    // Editing the field brings the suggestions back.
    const field = screen.getByRole("combobox", { name: "Owner" });
    await userEvent.type(field, "{Backspace}e");
    expect(await options()).toEqual(["burke", "mercedesburke"]);
  });
});
