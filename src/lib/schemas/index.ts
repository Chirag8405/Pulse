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
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Maximum 80 characters"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(200, "Maximum 200 characters"),
  targetSpreadPercentage: z
    .number()
    .min(50, "Must be between 50% and 90%")
    .max(90, "Must be between 50% and 90%"),
  targetZoneCount: z
    .number()
    .int("Target zone count must be an integer")
    .min(2, "Target zone count must be at least 2")
    .max(6, "Target zone count must be at most 6"),
  durationMinutes: z
    .number()
    .refine((value) => [8, 10, 12, 15].includes(value), {
      message: "Select a valid duration",
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
    .trim()
    .min(1, "Reward description is required")
    .max(150, "Maximum 150 characters"),
});
