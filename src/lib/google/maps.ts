/**
 * Google Maps service layer for venue operations.
 * Provides venue map initialization, zone polygon rendering,
 * and real-time heatmap visualization using the Google Maps JS API.
 */
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { VENUE_COORDINATES, ZONES } from "@/constants";
import { getErrorMessage } from "@/lib/shared/errorUtils";

/** Singleton state to avoid multiple API initialization attempts */
let loaderConfigured = false;
let googleMapsPromise: Promise<typeof google> | null = null;

/**
 * Returns the Google Maps API key from environment variables.
 * Throws if not configured.
 */
function getApiKey(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    throw new Error(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured. Add it to .env.local."
    );
  }

  return key;
}

/**
 * Lazily loads the Google Maps JavaScript API.
 * Returns the global `google` namespace.
 */
export async function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    throw new Error("Google Maps can only be loaded in the browser.");
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  if (!loaderConfigured) {
    setOptions({
      key: getApiKey(),
      v: "weekly",
      libraries: ["visualization", "marker"],
    });

    loaderConfigured = true;
  }

  googleMapsPromise = Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
    importLibrary("visualization"),
  ]).then(() => google);

  return googleMapsPromise;
}

/** Default map options for the venue map */
const VENUE_MAP_OPTIONS: google.maps.MapOptions = {
  center: { lat: VENUE_COORDINATES.lat, lng: VENUE_COORDINATES.lng },
  zoom: 17,
  mapTypeId: "satellite",
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "greedy",
  restriction: {
    latLngBounds: {
      north: VENUE_COORDINATES.lat + 0.003,
      south: VENUE_COORDINATES.lat - 0.003,
      east: VENUE_COORDINATES.lng + 0.003,
      west: VENUE_COORDINATES.lng - 0.003,
    },
    strictBounds: true,
  },
};

/**
 * Initializes a Google Map instance for venue display.
 */
export async function initVenueMap(
  container: HTMLElement
): Promise<google.maps.Map> {
  const google = await loadGoogleMaps();

  return new google.maps.Map(container, VENUE_MAP_OPTIONS);
}

/**
 * Zone polygon radius in degrees (roughly ~50m at equator latitude).
 */
const ZONE_RADIUS_DEG = 0.0004;

/**
 * Creates zone boundary polygons on the map, colored by occupancy level.
 */
export function renderZoneOverlays(
  map: google.maps.Map,
  occupancyByZone: Record<string, number>
): google.maps.Circle[] {
  const circles: google.maps.Circle[] = [];

  ZONES.forEach((zone) => {
    const count = occupancyByZone[zone.id] ?? 0;
    const densityRatio = Math.min(1, count / zone.capacity);

    // Red = overcrowded, Yellow = moderate, Green = low density
    const fillColor =
      densityRatio > 0.7
        ? "#DC2626"
        : densityRatio > 0.4
          ? "#F59E0B"
          : "#22C55E";

    const circle = new google.maps.Circle({
      map,
      center: { lat: zone.lat, lng: zone.lng },
      radius: ZONE_RADIUS_DEG * 111_000, // degrees → meters
      fillColor,
      fillOpacity: 0.35,
      strokeColor: fillColor,
      strokeWeight: 2,
      clickable: true,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="font-family:monospace;padding:4px">
          <strong>${zone.name}</strong><br/>
          Occupancy: ${count} / ${zone.capacity}<br/>
          Gate: ${zone.gate}
        </div>
      `,
    });

    circle.addListener("click", () => {
      infoWindow.setPosition({ lat: zone.lat, lng: zone.lng });
      infoWindow.open(map);
    });

    circles.push(circle);
  });

  return circles;
}

/**
 * Updates existing zone overlays with new occupancy data.
 * More efficient than recreating all overlays.
 */
export function updateZoneOverlayColors(
  circles: google.maps.Circle[],
  occupancyByZone: Record<string, number>
): void {
  ZONES.forEach((zone, index) => {
    const circle = circles[index];

    if (!circle) {
      return;
    }

    const count = occupancyByZone[zone.id] ?? 0;
    const densityRatio = Math.min(1, count / zone.capacity);

    const fillColor =
      densityRatio > 0.7
        ? "#DC2626"
        : densityRatio > 0.4
          ? "#F59E0B"
          : "#22C55E";

    circle.setOptions({
      fillColor,
      strokeColor: fillColor,
    });
  });
}

/**
 * Generates a static Google Maps URL for server-rendered venue previews.
 */
export function getStaticMapUrl(width = 600, height = 400): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return "";
  }

  const center = `${VENUE_COORDINATES.lat},${VENUE_COORDINATES.lng}`;

  return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=17&size=${width}x${height}&maptype=satellite&key=${key}`;
}

/**
 * Safe wrapper that returns null on failure instead of throwing.
 */
export async function safeLoadGoogleMaps(): Promise<typeof google | null> {
  try {
    return await loadGoogleMaps();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[maps] Google Maps load failed:", getErrorMessage(error));
    }

    return null;
  }
}
