import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveRegion } from "@/components/shared/LiveRegion";

describe("LiveRegion", () => {
  it("renders children", () => {
    render(<LiveRegion>Score updated</LiveRegion>);
    expect(screen.getByText("Score updated")).toBeInTheDocument();
  });

  it("has aria-live=polite by default", () => {
    render(<LiveRegion>Update</LiveRegion>);
    const region = screen.getByText("Update");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("role", "status");
  });

  it("supports assertive mode", () => {
    render(<LiveRegion politeness="assertive">Alert!</LiveRegion>);
    const region = screen.getByText("Alert!");
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(region).toHaveAttribute("role", "alert");
  });

  it("has aria-atomic=true", () => {
    render(<LiveRegion>Content</LiveRegion>);
    expect(screen.getByText("Content")).toHaveAttribute("aria-atomic", "true");
  });

  it("applies sr-only class when visuallyHidden", () => {
    render(<LiveRegion visuallyHidden>Hidden</LiveRegion>);
    expect(screen.getByText("Hidden")).toHaveClass("sr-only");
  });

  it("applies custom className when not hidden", () => {
    render(<LiveRegion className="custom-class">Visible</LiveRegion>);
    expect(screen.getByText("Visible")).toHaveClass("custom-class");
  });
});
