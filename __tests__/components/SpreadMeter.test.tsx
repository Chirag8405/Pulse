import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { SpreadMeter } from "@/components/shared/SpreadMeter";

describe("SpreadMeter", () => {
  test("renders with correct ARIA attributes", () => {
    render(<SpreadMeter value={63} target={75} />);

    const meter = screen.getByRole("progressbar");
    expect(meter).toHaveAttribute("aria-valuenow", "63");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
  });

  test("shows correct color class below 40%", () => {
    render(<SpreadMeter value={35} target={75} />);

    const meter = screen.getByRole("progressbar");
    expect(meter.querySelectorAll(".bg-zinc-300").length).toBeGreaterThan(0);
  });

  test("shows warning color at 60%", () => {
    render(<SpreadMeter value={60} target={75} />);

    const meter = screen.getByRole("progressbar");
    expect(meter.querySelectorAll(".bg-amber-400").length).toBeGreaterThan(0);
  });

  test("shows success color at 80%", () => {
    render(<SpreadMeter value={80} target={75} />);

    const meter = screen.getByRole("progressbar");
    expect(meter.querySelectorAll(".bg-emerald-500").length).toBeGreaterThan(0);
  });
});
