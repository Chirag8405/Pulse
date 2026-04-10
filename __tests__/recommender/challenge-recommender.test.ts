import { describe, expect, it } from "vitest";
import {
  getBestMoveForAttendee,
  recommendChallengeParams,
} from "@/lib/recommender/challengeRecommender";

describe("challengeRecommender", () => {
  it("returns different recommendations for different contexts", () => {
    const earlyMatch = recommendChallengeParams({
      currentOccupancy: {
        "zone-north": 5200,
        "zone-south": 5000,
        "zone-east": 2800,
        "zone-west": 1900,
        "zone-concourse-n": 1400,
      },
      eventMinutesElapsed: 18,
      historicalSpreadScores: [76, 74, 80, 77, 73],
      teamCount: 4,
    });

    const halftime = recommendChallengeParams({
      currentOccupancy: {
        "zone-north": 6000,
        "zone-south": 6200,
        "zone-east": 4000,
        "zone-west": 3500,
        "zone-concourse-n": 2500,
      },
      eventMinutesElapsed: 50,
      historicalSpreadScores: [42, 46, 49, 44, 47],
      teamCount: 4,
    });

    expect(earlyMatch.suggestedSpreadPercentage).toBe(80);
    expect(halftime.suggestedSpreadPercentage).toBe(60);
    expect(earlyMatch.suggestedDuration).toBe(12);
    expect(halftime.suggestedDuration).toBe(8);
  });

  it("returns stay-here reason when attendee is already in a strong target zone", () => {
    const bestMove = getBestMoveForAttendee({
      currentZoneId: "zone-west",
      teamMemberLocations: {
        "zone-west": 2,
        "zone-east": 5,
        "zone-concourse-n": 4,
      },
      targetZoneIds: ["zone-west", "zone-east", "zone-concourse-n"],
    });

    expect(bestMove.suggestedZoneId).toBe("zone-west");
    expect(bestMove.reason).toBe("You are in a great spot! Stay here.");
  });
});
