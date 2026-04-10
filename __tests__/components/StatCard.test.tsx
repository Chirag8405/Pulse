import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import { describe, expect, test } from "vitest";
import { StatCard } from "@/components/shared/StatCard";

describe("StatCard", () => {
  test("renders label, value, and icon", () => {
    const { container } = render(
      <StatCard label="Total Attendees" value={1234} icon={Activity} />
    );

    expect(screen.getByText("Total Attendees")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  test("shows green delta badge for positive delta", () => {
    render(<StatCard label="Spread" value="72%" delta={5} icon={Activity} />);

    const badge = screen.getByText("+5");
    expect(badge).toHaveClass("bg-emerald-500");
  });

  test("shows red delta badge for negative delta", () => {
    render(<StatCard label="Spread" value="45%" delta={-3} icon={Activity} />);

    const badge = screen.getByText("-3");
    expect(badge).toHaveClass("bg-red-600");
  });

  test("has role=region and aria-label", () => {
    render(
      <StatCard
        label="Challenges Today"
        value={7}
        icon={Activity}
        ariaLabel="Challenges stat card"
      />
    );

    const region = screen.getByRole("region", { name: "Challenges stat card" });
    expect(region).toBeInTheDocument();
  });
});
