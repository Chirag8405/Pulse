import { describe, expect, it } from "vitest";
import { getTeamForSeatSection, TEAM_MAPPINGS } from "@/constants/teams";

describe("getTeamForSeatSection", () => {
  it("maps sections A-C to North Stand Wolves", () => {
    expect(getTeamForSeatSection("A")?.id).toBe("team-north-wolves");
    expect(getTeamForSeatSection("B")?.id).toBe("team-north-wolves");
    expect(getTeamForSeatSection("C")?.id).toBe("team-north-wolves");
  });

  it("maps sections D-F to South Stand Lions", () => {
    expect(getTeamForSeatSection("D")?.id).toBe("team-south-lions");
    expect(getTeamForSeatSection("E")?.id).toBe("team-south-lions");
    expect(getTeamForSeatSection("F")?.id).toBe("team-south-lions");
  });

  it("maps sections G-I to East Stand Eagles", () => {
    expect(getTeamForSeatSection("G")?.id).toBe("team-east-eagles");
    expect(getTeamForSeatSection("H")?.id).toBe("team-east-eagles");
    expect(getTeamForSeatSection("I")?.id).toBe("team-east-eagles");
  });

  it("maps sections J-L to West Stand Rhinos", () => {
    expect(getTeamForSeatSection("J")?.id).toBe("team-west-rhinos");
    expect(getTeamForSeatSection("K")?.id).toBe("team-west-rhinos");
    expect(getTeamForSeatSection("L")?.id).toBe("team-west-rhinos");
  });

  it("maps sections M-O to North Concourse Bears", () => {
    expect(getTeamForSeatSection("M")?.id).toBe("team-north-bears");
    expect(getTeamForSeatSection("N")?.id).toBe("team-north-bears");
    expect(getTeamForSeatSection("O")?.id).toBe("team-north-bears");
  });

  it("maps sections P-R to South Concourse Tigers", () => {
    expect(getTeamForSeatSection("P")?.id).toBe("team-south-tigers");
    expect(getTeamForSeatSection("Q")?.name).toBe("South Concourse Tigers");
    expect(getTeamForSeatSection("R")?.name).toBe("South Concourse Tigers");
  });

  it("maps sections S-U to Main Entry Wolves", () => {
    expect(getTeamForSeatSection("S")?.id).toBe("team-main-wolves");
    expect(getTeamForSeatSection("T")?.id).toBe("team-main-wolves");
    expect(getTeamForSeatSection("U")?.id).toBe("team-main-wolves");
  });

  it("falls back to General Stand Crew for unknown sections", () => {
    expect(getTeamForSeatSection("Z")?.id).toBe("team-general");
    expect(getTeamForSeatSection("X")?.id).toBe("team-general");
  });

  it("handles lowercase input", () => {
    expect(getTeamForSeatSection("a")?.id).toBe("team-north-wolves");
    expect(getTeamForSeatSection("d")?.id).toBe("team-south-lions");
  });

  it("handles whitespace-padded input", () => {
    expect(getTeamForSeatSection("  A  ")?.id).toBe("team-north-wolves");
  });

  it("returns null for empty string", () => {
    expect(getTeamForSeatSection("")).toBeNull();
  });

  it("all team mappings have required properties", () => {
    TEAM_MAPPINGS.forEach((team) => {
      expect(team.id).toBeTruthy();
      expect(team.name).toBeTruthy();
      expect(team.emoji).toBeTruthy();
      expect(team.colorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(team.sectionPattern).toBeInstanceOf(RegExp);
      expect(team.zoneId).toBeTruthy();
    });
  });
});
