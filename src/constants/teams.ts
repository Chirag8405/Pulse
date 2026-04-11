import type { ZoneId } from "@/constants";

export interface TeamMapping {
  id: string;
  zoneId: ZoneId;
  name: string;
  emoji: string;
  colorHex: string;
  sectionPattern: RegExp;
}

export const TEAM_MAPPINGS: TeamMapping[] = [
  {
    id: "team-north-wolves",
    zoneId: "zone-north",
    name: "North Stand Wolves",
    emoji: "🐺",
    colorHex: "#2563EB",
    sectionPattern: /^[A-C]$/,
  },
  {
    id: "team-south-lions",
    zoneId: "zone-south",
    name: "South Stand Lions",
    emoji: "🦁",
    colorHex: "#DC2626",
    sectionPattern: /^[D-F]$/,
  },
  {
    id: "team-east-eagles",
    zoneId: "zone-east",
    name: "East Stand Eagles",
    emoji: "🦅",
    colorHex: "#059669",
    sectionPattern: /^[G-I]$/,
  },
  {
    id: "team-west-rhinos",
    zoneId: "zone-west",
    name: "West Stand Rhinos",
    emoji: "🦏",
    colorHex: "#7C3AED",
    sectionPattern: /^[J-L]$/,
  },
  {
    id: "team-north-bears",
    zoneId: "zone-concourse-n",
    name: "North Concourse Bears",
    emoji: "🐻",
    colorHex: "#D97706",
    sectionPattern: /^[M-O]$/,
  },
  {
    id: "team-south-tigers",
    zoneId: "zone-concourse-s",
    name: "South Concourse Tigers",
    emoji: "🐯",
    colorHex: "#DB2777",
    sectionPattern: /^[P-R]$/,
  },
  {
    id: "team-main-wolves",
    zoneId: "zone-entry-main",
    name: "Main Entry Wolves",
    emoji: "🐺",
    colorHex: "#0891B2",
    sectionPattern: /^[S-U]$/,
  },
  {
    id: "team-general",
    zoneId: "zone-entry-sec",
    name: "General Stand Crew",
    emoji: "🏟️",
    colorHex: "#374151",
    sectionPattern: /^$/,
  },
];

export function getTeamForSeatSection(
  seatSection: string
): TeamMapping | null {
  const normalized = seatSection.trim().toUpperCase();
  const sectionLetter = normalized.slice(0, 1);

  if (!sectionLetter) {
    return null;
  }

  const fallbackTeam = TEAM_MAPPINGS[TEAM_MAPPINGS.length - 1] ?? null;

  const matchingTeam = TEAM_MAPPINGS.slice(0, -1).find((team) =>
    team.sectionPattern.test(sectionLetter)
  );

  if (matchingTeam) {
    return matchingTeam;
  }

  return fallbackTeam ?? null;
}
