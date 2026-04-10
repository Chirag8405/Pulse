import { describe, expect, it } from "vitest";
import {
  getBestMoveForAttendee,
  recommendChallengeParams,
} from "@/lib/recommender/challengeRecommender";

const OCCUPANCY = {
  "zone-north": 2500,
  "zone-south": 2000,
  "zone-east": 1800,
  "zone-west": 1600,
  "zone-concourse-n": 1000,
  "zone-concourse-s": 900,
  "zone-entry-main": 1500,
  "zone-entry-sec": 1300,
};

describe("challenge recommender", () => {
  it("recommends lower spread target for low-performing teams", () => {
    const recommendation = recommendChallengeParams({
      currentOccupancy: OCCUPANCY,
      eventMinutesElapsed: 20,
      historicalSpreadScores: [32, 41, 49],
      teamCount: 4,
    });

    expect(recommendation.suggestedSpreadPercentage).toBe(60);
  });

  it("recommends 10 minute duration at minute 45", () => {
    const recommendation = recommendChallengeParams({
      currentOccupancy: OCCUPANCY,
      eventMinutesElapsed: 45,
      historicalSpreadScores: [60, 62, 67],
      teamCount: 4,
    });

    expect(recommendation.suggestedDuration).toBe(10);
  });

  it("recommends 15 minute duration after 70 minutes", () => {
    const recommendation = recommendChallengeParams({
      currentOccupancy: OCCUPANCY,
      eventMinutesElapsed: 75,
      historicalSpreadScores: [72, 74, 78],
      teamCount: 4,
    });

    expect(recommendation.suggestedDuration).toBe(15);
  });

  it("recommends staying when already in a target zone with few teammates", () => {
    const move = getBestMoveForAttendee({
      currentZoneId: "zone-east",
      targetZoneIds: ["zone-east", "zone-west", "zone-south"],
      teamMemberLocations: {
        "zone-east": 2,
        "zone-west": 4,
        "zone-south": 5,
      },
    });

    expect(move.suggestedZoneId).toBe("zone-east");
    expect(move.reason.toLowerCase()).toContain("stay here");
  });

  it("suggests a target zone when currently outside target zones", () => {
    const move = getBestMoveForAttendee({
      currentZoneId: "zone-entry-main",
      targetZoneIds: ["zone-east", "zone-west", "zone-south"],
      teamMemberLocations: {
        "zone-east": 2,
        "zone-west": 1,
        "zone-south": 3,
      },
    });

    expect(["zone-east", "zone-west", "zone-south"]).toContain(move.suggestedZoneId);
    expect(move.suggestedZoneId).not.toBe("zone-entry-main");
  });
});
