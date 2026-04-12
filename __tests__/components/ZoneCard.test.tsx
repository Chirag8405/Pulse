import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZoneCard } from "@/components/shared/ZoneCard";

const mockZone = {
  id: "zone-north",
  name: "North Stand",
  capacity: 8000,
  lat: 18.9392,
  lng: 72.8252,
  gate: "Gate 1-2",
};

describe("ZoneCard", () => {
  it("renders zone name and gate", () => {
    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={false}
        isCurrentUserHere={false}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText("North Stand")).toBeInTheDocument();
    expect(screen.getByText("Gate 1-2")).toBeInTheDocument();
  });

  it("displays member count", () => {
    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={false}
        isCurrentUserHere={false}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText("150 teammates here")).toBeInTheDocument();
  });

  it("shows 'You' badge when user is in this zone", () => {
    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={false}
        isCurrentUserHere={true}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByText("You")).toBeInTheDocument();
  });

  it("hides 'You' badge when user is not here", () => {
    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={false}
        isCurrentUserHere={false}
        onClick={vi.fn()}
      />
    );

    expect(screen.queryByText("You")).not.toBeInTheDocument();
  });

  it("shows target zone screen-reader text when isTarget", () => {
    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={true}
        isCurrentUserHere={false}
        onClick={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        ", this is a target zone for the current challenge"
      )
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={false}
        isCurrentUserHere={false}
        onClick={onClick}
      />
    );

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is rendered as a button for accessibility", () => {
    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={false}
        isCurrentUserHere={false}
        onClick={vi.fn()}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("has a progressbar with correct values", () => {
    render(
      <ZoneCard
        zone={mockZone}
        memberCount={150}
        totalTeamMembers={500}
        isTarget={false}
        isCurrentUserHere={false}
        onClick={vi.fn()}
      />
    );

    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute("aria-valuenow", "30");
    expect(progressbar).toHaveAttribute("aria-valuemin", "0");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });
});
