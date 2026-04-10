import { describe, expect, it } from "vitest";
import {
  AdminChallengeSchema,
  LocationUpdateSchema,
  SeatInputSchema,
  UserProfileUpdateSchema,
} from "@/lib/schemas";

describe("schema validation", () => {
  it("LocationUpdateSchema accepts valid zone and rejects invalid zone", () => {
    const valid = LocationUpdateSchema.safeParse({
      zoneId: "zone-north",
      timestamp: Date.now(),
    });

    const invalid = LocationUpdateSchema.safeParse({
      zoneId: "zone-unknown",
      timestamp: Date.now(),
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);

    if (!invalid.success) {
      expect(invalid.error.issues[0]?.message).toContain("Invalid zone ID");
    }
  });

  it("SeatInputSchema validates strict seat format", () => {
    expect(SeatInputSchema.safeParse("A-12-34").success).toBe(true);
    expect(SeatInputSchema.safeParse("a-12-34").success).toBe(false);
    expect(SeatInputSchema.safeParse("A-12").success).toBe(false);
  });

  it("AdminChallengeSchema rejects invalid duration and spread target", () => {
    const base = {
      title: "Halftime Redistribution",
      description: "Move attendees from dense zones to improve spread score.",
      targetSpreadPercentage: 75,
      targetZoneCount: 3,
      durationMinutes: 10,
      rewardType: "Food Credit",
      rewardDescription: "Free drink coupon",
    } as const;

    expect(AdminChallengeSchema.safeParse(base).success).toBe(true);

    const invalidDuration = AdminChallengeSchema.safeParse({
      ...base,
      durationMinutes: 7,
    });

    const invalidSpread = AdminChallengeSchema.safeParse({
      ...base,
      targetSpreadPercentage: 95,
    });

    expect(invalidDuration.success).toBe(false);
    expect(invalidSpread.success).toBe(false);
  });

  it("UserProfileUpdateSchema enforces min/max displayName length", () => {
    expect(UserProfileUpdateSchema.safeParse({ displayName: "Ab" }).success).toBe(true);
    expect(UserProfileUpdateSchema.safeParse({ displayName: "A" }).success).toBe(false);
    expect(
      UserProfileUpdateSchema.safeParse({ displayName: "x".repeat(51) }).success
    ).toBe(false);
  });
});
