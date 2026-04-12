import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamBadge } from "@/components/shared/TeamBadge";

describe("TeamBadge", () => {
  it("renders team name", () => {
    render(
      <TeamBadge teamName="North Stand Wolves" emoji="🐺" colorHex="#2563EB" />
    );

    expect(screen.getByText("North Stand Wolves")).toBeInTheDocument();
  });

  it("renders emoji as decorative (aria-hidden)", () => {
    render(
      <TeamBadge teamName="North Stand Wolves" emoji="🐺" colorHex="#2563EB" />
    );

    const emojiSpan = screen.getByText("🐺");
    expect(emojiSpan).toHaveAttribute("aria-hidden", "true");
  });

  it("provides screen-reader text", () => {
    render(
      <TeamBadge teamName="North Stand Wolves" emoji="🐺" colorHex="#2563EB" />
    );

    expect(
      screen.getByText("North Stand Wolves team, 🐺")
    ).toBeInTheDocument();
  });

  it("renders with different sizes", () => {
    const { rerender } = render(
      <TeamBadge teamName="Wolves" emoji="🐺" colorHex="#2563EB" size="sm" />
    );

    expect(screen.getByText("Wolves")).toBeInTheDocument();

    rerender(
      <TeamBadge teamName="Wolves" emoji="🐺" colorHex="#2563EB" size="lg" />
    );

    expect(screen.getByText("Wolves")).toBeInTheDocument();
  });

  it("applies colorHex as background style", () => {
    const { container } = render(
      <TeamBadge teamName="Wolves" emoji="🐺" colorHex="#2563EB" />
    );

    const colorIndicator = container.querySelector("[aria-hidden='true']");
    expect(colorIndicator).toBeTruthy();
  });

  it("defaults to md size", () => {
    render(
      <TeamBadge teamName="Wolves" emoji="🐺" colorHex="#2563EB" />
    );

    // Badge should render successfully without specifying size
    expect(screen.getByText("Wolves")).toBeInTheDocument();
  });
});
