import { z } from "zod";

export const VALID_ZONE_IDS = [
  "zone-north",
  "zone-south",
  "zone-east",
  "zone-west",
  "zone-concourse-n",
  "zone-concourse-s",
  "zone-entry-main",
  "zone-entry-sec",
] as const;

export const LocationUpdateSchema = z.object({
  zoneId: z.enum(VALID_ZONE_IDS, {
    error: "Invalid zone ID",
  }),
  timestamp: z.number().positive("Timestamp must be a positive number"),
});

export const SeatInputSchema = z
  .string()
  .regex(/^[A-Z]{1,2}-\d{1,2}-\d{1,3}$/, "Format: Section-Row-Seat (e.g. A-12-34)");

export const UserProfileUpdateSchema = z.object({
  displayName: z
    .string()
    .min(2, "At least 2 characters")
    .max(50, "Max 50 characters"),
});

export const AdminChallengeSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(80, "Title must be at most 80 characters"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(200, "Description must be at most 200 characters"),
  targetSpreadPercentage: z
    .number()
    .min(50, "Target spread percentage must be at least 50")
    .max(90, "Target spread percentage must be at most 90"),
  targetZoneCount: z
    .number()
    .int("Target zone count must be an integer")
    .min(2, "Target zone count must be at least 2")
    .max(6, "Target zone count must be at most 6"),
  durationMinutes: z
    .number()
    .refine((value) => [8, 10, 12, 15].includes(value), {
      message: "Duration must be one of: 8, 10, 12, 15 minutes",
    }),
  rewardType: z.enum([
    "Early Entry",
    "Exclusive Zone Access",
    "Food Credit",
    "Meet & Greet Lottery",
    "Stadium Tour",
  ]),
  rewardDescription: z
    .string()
    .min(5, "Reward description must be at least 5 characters")
    .max(150, "Reward description must be at most 150 characters"),
});
