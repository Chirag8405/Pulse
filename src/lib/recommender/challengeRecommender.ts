import { ZONES } from "@/constants";

interface RecommendChallengeInput {
  currentOccupancy: Record<string, number>;
  eventMinutesElapsed: number;
  historicalSpreadScores: number[];
  teamCount: number;
}

interface RecommendChallengeOutput {
  suggestedTargetZones: string[];
  suggestedSpreadPercentage: number;
  suggestedDuration: number;
  reasoning: string;
}

interface BestMoveInput {
  currentZoneId: string;
  teamMemberLocations: Record<string, number>;
  targetZoneIds: string[];
}

interface BestMoveOutput {
  suggestedZoneId: string;
  reason: string;
}

interface ZoneMoveStats {
  zoneId: string;
  teammateCount: number;
  availableCapacity: number;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRecommendedDuration(eventMinutesElapsed: number): number {
  const halftimeWindow = eventMinutesElapsed >= 45 && eventMinutesElapsed <= 55;

  if (halftimeWindow) {
    return 8;
  }

  if (eventMinutesElapsed < 30) {
    return 12;
  }

  if (eventMinutesElapsed <= 60) {
    return 10;
  }

  if (eventMinutesElapsed > 70) {
    return 15;
  }

  return 10;
}

export function recommendChallengeParams(
  input: RecommendChallengeInput
): RecommendChallengeOutput {
  const occupancyByZone = ZONES.map((zone) => ({
    zoneId: zone.id,
    zoneName: zone.name,
    occupancy: input.currentOccupancy[zone.id] ?? 0,
  }));

  const suggestedTargetZones = occupancyByZone
    .toSorted((left, right) => left.occupancy - right.occupancy)
    .slice(0, 3)
    .map((zone) => zone.zoneId);

  const historicalAverage = average(input.historicalSpreadScores);

  const suggestedSpreadPercentage =
    input.historicalSpreadScores.length === 0 || historicalAverage < 50
      ? 60
      : historicalAverage > 70
        ? 80
        : 70;

  const suggestedDuration = getRecommendedDuration(input.eventMinutesElapsed);

  const readableTargetZoneNames = occupancyByZone
    .filter((zone) => suggestedTargetZones.includes(zone.zoneId))
    .map((zone) => `${zone.zoneName} (${zone.occupancy})`)
    .join(", ");

  const reasoning =
    `Selected low-density zones: ${readableTargetZoneNames}. ` +
    `Recent spread average is ${historicalAverage.toFixed(1)}%, so target spread is set to ${suggestedSpreadPercentage}%. ` +
    `At minute ${input.eventMinutesElapsed}, recommended duration is ${suggestedDuration} minutes for ${input.teamCount} teams.`;

  return {
    suggestedTargetZones,
    suggestedSpreadPercentage,
    suggestedDuration,
    reasoning,
  };
}

export function getBestMoveForAttendee(input: BestMoveInput): BestMoveOutput {
  const zoneStats: ZoneMoveStats[] = input.targetZoneIds.map((zoneId) => {
    const matchingZone = ZONES.find((zone) => zone.id === zoneId);
    const teammateCount = input.teamMemberLocations[zoneId] ?? 0;
    const capacity = matchingZone?.capacity ?? 0;

    return {
      zoneId,
      teammateCount,
      availableCapacity: Math.max(0, capacity - teammateCount),
    };
  });

  if (zoneStats.length === 0) {
    return {
      suggestedZoneId: input.currentZoneId,
      reason: "No target zones are active right now. Stay in your current zone.",
    };
  }

  const fewestTeammates = Math.min(...zoneStats.map((zone) => zone.teammateCount));

  const currentZoneStats = zoneStats.find(
    (zone) => zone.zoneId === input.currentZoneId
  );

  if (currentZoneStats && currentZoneStats.teammateCount === fewestTeammates) {
    return {
      suggestedZoneId: input.currentZoneId,
      reason: "You are in a great spot! Stay here.",
    };
  }

  const bestZone = zoneStats.toSorted((left, right) => {
    if (left.teammateCount !== right.teammateCount) {
      return left.teammateCount - right.teammateCount;
    }

    return right.availableCapacity - left.availableCapacity;
  })[0];

  if (!bestZone) {
    return {
      suggestedZoneId: input.currentZoneId,
      reason: "No better target zone is currently available. Stay where you are.",
    };
  }

  return {
    suggestedZoneId: bestZone.zoneId,
    reason: `Move to ${bestZone.zoneId}. It has fewer teammates and better available capacity for spread impact.`,
  };
}
