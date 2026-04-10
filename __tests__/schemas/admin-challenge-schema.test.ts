import { describe, expect, it } from "vitest";
import { AdminChallengeSchema } from "@/lib/schemas";

describe("AdminChallengeSchema", () => {
  it("returns an error for empty payload", () => {
    const result = AdminChallengeSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
