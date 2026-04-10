"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { Expand, Map } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ZONES } from "@/constants";

interface VenueHeatmapProps {
  occupancyData: Record<string, number>;
}

interface GoogleMapLike {
  setOptions: (options: { styles?: unknown[] }) => void;
  getZoom: () => number | undefined;
  setZoom: (zoom: number) => void;
  unbindAll: () => void;
}

interface GoogleMarkerLike {
  setMap: (map: GoogleMapLike | null) => void;
  setIcon: (icon: { url: string }) => void;
  addListener: (eventName: string, handler: () => void) => void;
}

interface GoogleInfoWindowLike {
  setContent: (content: string) => void;
  open: (options: { map: GoogleMapLike; anchor: GoogleMarkerLike }) => void;
  close: () => void;
}

interface GoogleHeatmapLike {
  setMap: (map: GoogleMapLike | null) => void;
  setData: (data: Array<{ location: unknown; weight: number }>) => void;
}

interface GoogleMapsApi {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapLike;
    Marker: new (options: Record<string, unknown>) => GoogleMarkerLike;
    InfoWindow: new () => GoogleInfoWindowLike;
    LatLng: new (lat: number, lng: number) => unknown;
    visualization: {
      HeatmapLayer: new (options: Record<string, unknown>) => GoogleHeatmapLike;
    };
  };
}

interface MarkerEntry {
  zoneId: string;
  marker: GoogleMarkerLike;
}

interface HeatmapDataPoint {
  zoneId: string;
  lat: number;
  lng: number;
  weight: number;
}

const MAP_CENTER = { lat: 18.9388, lng: 72.8252 };
const DEFAULT_ZOOM = 17;
const MIN_ZOOM = 16;
const MAX_ZOOM = 19;

const DARK_SATELLITE_STYLES = [
  {
    elementType: "geometry",
    stylers: [{ saturation: -20 }, { lightness: -12 }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#f5f5f5" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1f1f1f" }, { weight: 2 }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2a2a2a" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d4d4d4" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d4d4d4" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
];

let mapsOptionsConfigured = false;

function getGoogleApi(): GoogleMapsApi | null {
  const candidate = (window as Window & { google?: unknown }).google;

  if (!candidate) {
    return null;
  }

  return candidate as GoogleMapsApi;
}

function getZoneInitial(zoneId: string): string {
  if (zoneId === "zone-north") {
    return "N";
  }

  if (zoneId === "zone-south") {
    return "S";
  }

  if (zoneId === "zone-east") {
    return "E";
  }

  if (zoneId === "zone-west") {
    return "W";
  }

  if (zoneId === "zone-concourse-n") {
    return "CN";
  }

  if (zoneId === "zone-concourse-s") {
    return "CS";
  }

  if (zoneId === "zone-entry-main") {
    return "ME";
  }

  if (zoneId === "zone-entry-sec") {
    return "SE";
  }

  return "?";
}

function getActiveAttendeeCount(occupancyData: Record<string, number>): number {
  return Object.values(occupancyData).reduce((sum, count) => sum + count, 0);
}

function getTopZones(occupancyData: Record<string, number>, limit = 3): string[] {
  return ZONES.map((zone) => ({
    id: zone.id,
    count: occupancyData[zone.id] ?? 0,
  }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((entry) => entry.id);
}

function createMarkerIcon(
  zoneInitial: string,
  isActiveTarget: boolean
) {
  const fillColor = isActiveTarget ? "#2563EB" : "#F59E0B";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="${fillColor}" stroke="#000000" stroke-width="2" />
      <text x="16" y="19" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="#000000">${zoneInitial}</text>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  };
}

function toGoogleHeatmapPoints(
  googleApi: GoogleMapsApi,
  heatmapData: HeatmapDataPoint[]
) {
  return heatmapData.map((point) => ({
    location: new googleApi.maps.LatLng(point.lat, point.lng),
    weight: point.weight,
  }));
}

function buildInfoWindowContent(
  zoneId: string,
  occupancyData: Record<string, number>
): string {
  const zone = ZONES.find((candidate) => candidate.id === zoneId);

  if (!zone) {
    return "<div>Zone unavailable</div>";
  }

  const count = occupancyData[zone.id] ?? 0;
  const occupancyPercent =
    zone.capacity > 0 ? Math.round((count / zone.capacity) * 100) : 0;

  return `
    <div style="min-width: 170px; font-family: ui-sans-serif, system-ui, sans-serif;">
      <p style="margin: 0; font-weight: 700; font-size: 14px;">${zone.name}</p>
      <p style="margin: 4px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;">Current: ${count}</p>
      <p style="margin: 2px 0 0; color: #6b7280; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;">Capacity: ${zone.capacity}</p>
      <p style="margin: 2px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;">Occupancy: ${occupancyPercent}%</p>
    </div>
  `;
}

function applyThemeStyle(map: GoogleMapLike): void {
  const isDarkTheme = document.documentElement.classList.contains("dark");

  map.setOptions({
    styles: isDarkTheme ? DARK_SATELLITE_STYLES : [],
  });
}

export default function VenueHeatmap({ occupancyData }: VenueHeatmapProps) {
  const mapRootRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<GoogleMapLike | null>(null);
  const heatmapLayerRef = useRef<GoogleHeatmapLike | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindowLike | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const mutationObserverRef = useRef<MutationObserver | null>(null);

  const latestOccupancyRef = useRef(occupancyData);

  const [mapError, setMapError] = useState<string | null>(() =>
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? null : "missing-api-key"
  );
  const [liveActiveCount, setLiveActiveCount] = useState(() =>
    getActiveAttendeeCount(occupancyData)
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeTargetZoneIds = useMemo(
    () => getTopZones(occupancyData, 3),
    [occupancyData]
  );

  const heatmapData = useMemo(() => {
    return ZONES.map((zone) => ({
      zoneId: zone.id,
      lat: zone.lat,
      lng: zone.lng,
      weight: occupancyData[zone.id] ?? 0,
    }));
  }, [occupancyData]);

  const screenReaderZoneData = useMemo(() => {
    return ZONES.map((zone) => {
      const count = occupancyData[zone.id] ?? 0;
      const percent = zone.capacity > 0 ? Math.round((count / zone.capacity) * 100) : 0;

      return `${zone.name}: ${percent} percent occupied`;
    });
  }, [occupancyData]);

  const highCapacityZone = useMemo(() => {
    return ZONES.find((zone) => {
      const count = occupancyData[zone.id] ?? 0;
      return zone.capacity > 0 && count / zone.capacity > 0.8;
    });
  }, [occupancyData]);

  const liveAnnouncement = highCapacityZone
    ? `Alert: ${highCapacityZone.name} is at high capacity.`
    : "";

  useEffect(() => {
    latestOccupancyRef.current = occupancyData;
  }, [occupancyData]);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!key) {
      return;
    }

    let disposed = false;

    const initializeMap = async () => {
      try {
        if (!mapsOptionsConfigured) {
          setOptions({
            key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
            v: "weekly",
            libraries: ["visualization", "maps"],
          });
          mapsOptionsConfigured = true;
        }

        await Promise.all([importLibrary("maps"), importLibrary("visualization")]);

        const googleApi = getGoogleApi();

        if (disposed || !mapCanvasRef.current || !googleApi) {
          return;
        }

        const map = new googleApi.maps.Map(mapCanvasRef.current, {
          center: MAP_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          mapTypeId: "satellite",
          disableDefaultUI: true,
          gestureHandling: "cooperative",
        });

        mapRef.current = map;
        applyThemeStyle(map);

        const heatmapLayer = new googleApi.maps.visualization.HeatmapLayer({
          data: toGoogleHeatmapPoints(
            googleApi,
            ZONES.map((zone) => ({
              zoneId: zone.id,
              lat: zone.lat,
              lng: zone.lng,
              weight: latestOccupancyRef.current[zone.id] ?? 0,
            }))
          ),
          radius: 30,
          opacity: 0.7,
          gradient: [
            "rgba(0,0,0,0)",
            "rgba(34,211,238,0.55)",
            "rgba(59,130,246,0.8)",
            "rgba(239,68,68,0.95)",
          ],
        });

        heatmapLayer.setMap(map);
        heatmapLayerRef.current = heatmapLayer;

        const infoWindow = new googleApi.maps.InfoWindow();
        infoWindowRef.current = infoWindow;

        const initialTargetZones = getTopZones(latestOccupancyRef.current, 3);

        markersRef.current = ZONES.map((zone) => {
          const marker = new googleApi.maps.Marker({
            map,
            position: { lat: zone.lat, lng: zone.lng },
            title: zone.name,
            icon: createMarkerIcon(
              getZoneInitial(zone.id),
              initialTargetZones.includes(zone.id)
            ),
          });

          marker.addListener("click", () => {
            infoWindow.setContent(
              buildInfoWindowContent(zone.id, latestOccupancyRef.current)
            );
            infoWindow.open({
              map,
              anchor: marker,
            });
          });

          return {
            zoneId: zone.id,
            marker,
          };
        });

        const observer = new MutationObserver(() => {
          if (!mapRef.current) {
            return;
          }

          applyThemeStyle(mapRef.current);
        });

        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        mutationObserverRef.current = observer;

        setMapError(null);
      } catch {
        if (!disposed) {
          setMapError("load-failed");
        }
      }
    };

    void initializeMap();

    return () => {
      disposed = true;

      heatmapLayerRef.current?.setMap(null);
      heatmapLayerRef.current = null;

      markersRef.current.forEach((entry) => {
        entry.marker.setMap(null);
      });
      markersRef.current = [];

      infoWindowRef.current?.close();
      infoWindowRef.current = null;

      mutationObserverRef.current?.disconnect();
      mutationObserverRef.current = null;

      mapRef.current?.unbindAll();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const googleApi = getGoogleApi();

    if (!heatmapLayerRef.current || !googleApi) {
      return;
    }

    heatmapLayerRef.current.setData(toGoogleHeatmapPoints(googleApi, heatmapData));

    markersRef.current.forEach((entry) => {
      entry.marker.setIcon(
        createMarkerIcon(
          getZoneInitial(entry.zoneId),
          activeTargetZoneIds.includes(entry.zoneId)
        )
      );
    });
  }, [activeTargetZoneIds, heatmapData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setLiveActiveCount(getActiveAttendeeCount(latestOccupancyRef.current));
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mapRootRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const handleZoomIn = () => {
    if (!mapRef.current) {
      return;
    }

    const zoom = mapRef.current.getZoom() ?? DEFAULT_ZOOM;
    mapRef.current.setZoom(Math.min(MAX_ZOOM, zoom + 1));
  };

  const handleZoomOut = () => {
    if (!mapRef.current) {
      return;
    }

    const zoom = mapRef.current.getZoom() ?? DEFAULT_ZOOM;
    mapRef.current.setZoom(Math.max(MIN_ZOOM, zoom - 1));
  };

  const handleToggleFullscreen = async () => {
    if (!mapRootRef.current) {
      return;
    }

    if (document.fullscreenElement === mapRootRef.current) {
      await document.exitFullscreen();
      return;
    }

    await mapRootRef.current.requestFullscreen();
  };

  if (mapError) {
    return (
      <section className="nb-card bg-card p-4">
        <EmptyState
          icon={Map}
          title="Map unavailable"
          description="Map unavailable. Check Google Maps API key configuration."
        />
      </section>
    );
  }

  return (
    <section className="nb-card overflow-hidden bg-card p-0">
      <div ref={mapRootRef} className="relative h-[420px] w-full">
        <div
          ref={mapCanvasRef}
          role="region"
          aria-label="Venue crowd density map"
          className="h-full w-full"
        />

        <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={handleZoomIn}
            className="nb-btn h-9 w-9 border-2 border-border bg-card font-mono text-lg font-black"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={handleZoomOut}
            className="nb-btn h-9 w-9 border-2 border-border bg-card font-mono text-lg font-black"
          >
            -
          </button>
        </div>

        <div className="absolute left-3 bottom-3 z-10">
          <button
            type="button"
            aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
            onClick={() => {
              void handleToggleFullscreen();
            }}
            className="nb-btn inline-flex h-9 items-center gap-2 border-2 border-border bg-card px-3 font-mono text-xs font-bold uppercase"
          >
            <Expand className="size-4" />
            {isFullscreen ? "Exit Full" : "Full Screen"}
          </button>
        </div>

        <aside className="nb-card absolute bottom-3 right-3 z-10 w-56 border-2 border-border bg-card p-3">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Crowd Density
          </p>
          <div className="mt-2 h-3 border-2 border-border bg-gradient-to-r from-cyan-400 via-blue-500 to-red-500" />
          <div className="mt-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Low</span>
            <span>High</span>
          </div>
          <p className="mt-2 font-mono text-xs font-bold">
            {liveActiveCount} active attendees
          </p>
        </aside>

        <ul className="sr-only" aria-label="Zone occupancy data">
          {screenReaderZoneData.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="sr-only" aria-live="polite">
          {liveAnnouncement}
        </div>
      </div>
    </section>
  );
}
