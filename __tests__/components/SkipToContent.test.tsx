import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkipToContent } from "@/components/shared/SkipToContent";

describe("SkipToContent", () => {
  it("renders a link targeting #main-content", () => {
    render(<SkipToContent />);
    const link = screen.getByText("Skip to main content");
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("has sr-only class for visual hiding", () => {
    render(<SkipToContent />);
    const link = screen.getByText("Skip to main content");
    expect(link).toHaveClass("sr-only");
  });
});
