import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock firebase/analytics
vi.mock("firebase/analytics", () => ({
  logEvent: vi.fn(),
  setUserId: vi.fn(),
  setUserProperties: vi.fn(),
}));

// Mock firebase config
vi.mock("@/lib/firebase/config", () => ({
  analyticsPromise: Promise.resolve({
    app: {},
  }),
}));

import { logEvent, setUserId, setUserProperties } from "firebase/analytics";
import {
  logVenueAnalyticsEvent,
  setAnalyticsUserId,
  setAnalyticsUserProperties,
  logScreenView,
} from "@/lib/firebase/analytics";

describe("Firebase Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logVenueAnalyticsEvent", () => {
    it("logs event with correct name", async () => {
      logVenueAnalyticsEvent("event_started");

      // Wait for promise resolution
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "event_started",
        {}
      );
    });

    it("logs event with params", async () => {
      logVenueAnalyticsEvent("challenge_completed", {
        challengeId: "c1",
        teamId: "t1",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "challenge_completed",
        { challengeId: "c1", teamId: "t1" }
      );
    });

    it("supports all defined event names", () => {
      const eventNames = [
        "event_started",
        "event_halftime",
        "event_ended",
        "challenge_created",
        "challenge_completed",
        "team_joined",
        "zone_changed",
        "location_permission_granted",
        "location_permission_denied",
        "leaderboard_viewed",
        "reward_unlocked",
        "admin_dashboard_viewed",
      ] as const;

      eventNames.forEach((name) => {
        expect(() => logVenueAnalyticsEvent(name)).not.toThrow();
      });
    });
  });

  describe("setAnalyticsUserId", () => {
    it("sets user ID for analytics", async () => {
      setAnalyticsUserId("user-123");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(setUserId).toHaveBeenCalledWith(
        expect.anything(),
        "user-123"
      );
    });
  });

  describe("setAnalyticsUserProperties", () => {
    it("sets user properties for segmentation", async () => {
      setAnalyticsUserProperties({ teamId: "team-1", role: "attendee" });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(setUserProperties).toHaveBeenCalledWith(
        expect.anything(),
        { teamId: "team-1", role: "attendee" }
      );
    });
  });

  describe("logScreenView", () => {
    it("logs screen view with name", async () => {
      logScreenView("Dashboard");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "screen_view",
        {
          firebase_screen: "Dashboard",
          firebase_screen_class: "Dashboard",
        }
      );
    });

    it("logs screen view with custom class", async () => {
      logScreenView("AdminDashboard", "AdminPage");

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "screen_view",
        {
          firebase_screen: "AdminDashboard",
          firebase_screen_class: "AdminPage",
        }
      );
    });
  });
});
