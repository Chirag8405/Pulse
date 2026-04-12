import { logEvent, setUserProperties, setUserId } from "firebase/analytics";
import { analyticsPromise } from "@/lib/firebase/config";

export type VenueAnalyticsEventName =
  | "event_started"
  | "event_halftime"
  | "event_ended"
  | "challenge_created"
  | "challenge_completed"
  | "team_joined"
  | "zone_changed"
  | "location_permission_granted"
  | "location_permission_denied"
  | "leaderboard_viewed"
  | "reward_unlocked"
  | "admin_dashboard_viewed";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export function logVenueAnalyticsEvent(
  eventName: VenueAnalyticsEventName,
  params: AnalyticsParams = {}
): void {
  void analyticsPromise.then((analytics) => {
    if (!analytics) {
      return;
    }

    logEvent(analytics, eventName, params);
  });
}

/**
 * Sets the user ID for Google Analytics session attribution.
 */
export function setAnalyticsUserId(userId: string): void {
  void analyticsPromise.then((analytics) => {
    if (!analytics) {
      return;
    }

    setUserId(analytics, userId);
  });
}

/**
 * Sets user properties for segmentation in Google Analytics.
 */
export function setAnalyticsUserProperties(
  properties: Record<string, string | null>
): void {
  void analyticsPromise.then((analytics) => {
    if (!analytics) {
      return;
    }

    setUserProperties(analytics, properties);
  });
}

/**
 * Logs a screen/page view event for Google Analytics.
 */
export function logScreenView(screenName: string, screenClass?: string): void {
  void analyticsPromise.then((analytics) => {
    if (!analytics) {
      return;
    }

    logEvent(analytics, "screen_view", {
      firebase_screen: screenName,
      firebase_screen_class: screenClass ?? screenName,
    });
  });
}

