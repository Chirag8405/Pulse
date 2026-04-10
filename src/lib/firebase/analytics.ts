import { logEvent } from "firebase/analytics";
import { analytics } from "@/lib/firebase/config";

export type VenueAnalyticsEventName =
  | "event_started"
  | "event_halftime"
  | "event_ended"
  | "challenge_created"
  | "challenge_completed";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

export function logVenueAnalyticsEvent(
  eventName: VenueAnalyticsEventName,
  params: AnalyticsParams = {}
): void {
  if (!analytics) {
    return;
  }

  logEvent(analytics, eventName, params);
}
