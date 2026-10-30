import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Map as MapLibreMap } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import { DownloadPanel } from "../components/DownloadPanel.tsx";
import { datedFileName } from "./download.ts";
import { ExportTooLargeError, type renderPng } from "./png.ts";

describe("datedFileName (Image file naming)", () => {
  it("Scenario: File name", () => {
    expect(datedFileName("png", new Date(2026, 10, 3, 23, 30))).toBe(
      "openmrs-atlas-2026-11-03.png",
    );
    expect(datedFileName("csv", new Date(2026, 0, 9))).toBe("openmrs-atlas-2026-01-09.csv");
  });
});

const fakeMap = {
  getContainer: () => ({ clientWidth: 1280, clientHeight: 720 }),
} as unknown as MapLibreMap;

describe("DownloadPanel", () => {
  it("offers 1x, 2x and 4x with the resulting pixel sizes", () => {
    render(<DownloadPanel map={fakeMap} legend={[]} onClose={() => {}} maxSide={() => 8192} />);
    expect(screen.getByLabelText("4x (5120 × 2880 px)")).toHaveProperty("disabled", false);
    expect(screen.getByText("Map attribution is always included.")).toBeTruthy();
  });

  it("disables sizes the device cannot render", () => {
    render(<DownloadPanel map={fakeMap} legend={[]} onClose={() => {}} maxSide={() => 4096} />);
    expect(screen.getByLabelText(/^4x/)).toHaveProperty("disabled", true);
    expect(screen.getByLabelText(/^4x/).parentElement?.textContent).toContain("too large");
    expect(screen.getByLabelText(/^2x/)).toHaveProperty("disabled", false);
  });

  it("passes the chosen options to the renderer", async () => {
    const renderer = vi.fn<typeof renderPng>().mockResolvedValue(new Blob(["x"]));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const legend = [{ value: "Clinical", colour: "#7B3FBF" }];
    render(
      <DownloadPanel
        map={fakeMap}
        legend={legend}
        onClose={() => {}}
        render={renderer}
        maxSide={() => 8192}
      />,
    );
    await userEvent.click(screen.getByLabelText(/^4x/));
    await userEvent.click(screen.getByRole("checkbox", { name: "Date" }));
    await userEvent.click(screen.getByRole("button", { name: "Download image" }));
    expect(renderer).toHaveBeenCalledWith(fakeMap, {
      scale: 4,
      title: "OpenMRS Atlas",
      legend,
      date: undefined,
    });
  });

  it("asks for a smaller size when the image is too large", async () => {
    const renderer = vi.fn<typeof renderPng>().mockRejectedValue(new ExportTooLargeError());
    render(
      <DownloadPanel
        map={fakeMap}
        legend={[]}
        onClose={() => {}}
        render={renderer}
        maxSide={() => 8192}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Download image" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Try a smaller size");
    expect(screen.getByRole("button", { name: "Download image" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
