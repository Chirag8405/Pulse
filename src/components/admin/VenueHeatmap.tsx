"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Expand, Map } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ZONES } from "@/constants";
import { safeLoadGoogleMaps } from "@/lib/google/maps";

interface VenueHeatmapProps {
  occupancyData: Record<string, number>;
}

interface ZoneCircleEntry {
  zoneId: string;
  circle: google.maps.Circle;
}

const MAP_CENTER = { lat: 18.9388, lng: 72.8252 };
const DEFAULT_ZOOM = 17;
const MIN_ZOOM = 16;
const MAX_ZOOM = 19;

const DARK_SATELLITE_STYLES: google.maps.MapTypeStyle[] = [
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

function applyThemeStyle(map: google.maps.Map): void {
  const isDarkTheme = document.documentElement.classList.contains("dark");

  map.setOptions({
    styles: isDarkTheme ? DARK_SATELLITE_STYLES : [],
  });
}

function getZoneOccupancyPercent(
  zoneId: string,
  occupancyData: Record<string, number>
): number {
  const zone = ZONES.find((entry) => entry.id === zoneId);

  if (!zone || zone.capacity <= 0) {
    return 0;
  }

  const count = occupancyData[zoneId] ?? 0;
  return Math.max(0, Math.min(100, (count / zone.capacity) * 100));
}

function getCircleColor(occupancyPercent: number): string {
  if (occupancyPercent >= 75) {
    return "#ef4444";
  }

  if (occupancyPercent >= 40) {
    return "#3b82f6";
  }

  return "#22d3ee";
}

function getZoneCircleOptions(
  zoneId: string,
  occupancyData: Record<string, number>,
  isActiveTarget: boolean
): google.maps.CircleOptions {
  const occupancyPercent = getZoneOccupancyPercent(zoneId, occupancyData);
  const baseColor = getCircleColor(occupancyPercent);

  return {
    radius: 22 + occupancyPercent * 0.95,
    fillColor: baseColor,
    fillOpacity: isActiveTarget ? 0.6 : 0.44,
    strokeColor: isActiveTarget ? "#facc15" : "#111827",
    strokeOpacity: 0.95,
    strokeWeight: isActiveTarget ? 3 : 2,
  };
}

export default function VenueHeatmap({ occupancyData }: VenueHeatmapProps) {
  const mapRootRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);

  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const circlesRef = useRef<ZoneCircleEntry[]>([]);
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
        const googleApi = await safeLoadGoogleMaps();

        if (disposed || !mapCanvasRef.current) {
          return;
        }

        if (!googleApi) {
          setMapError("load-failed");
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

        const infoWindow = new googleApi.maps.InfoWindow();
        infoWindowRef.current = infoWindow;

        const initialTargetZones = getTopZones(latestOccupancyRef.current, 3);

        circlesRef.current = ZONES.map((zone) => {
          const isActiveTarget = initialTargetZones.includes(zone.id);
          const circle = new googleApi.maps.Circle({
            map,
            center: { lat: zone.lat, lng: zone.lng },
            ...getZoneCircleOptions(zone.id, latestOccupancyRef.current, isActiveTarget),
          });

          circle.addListener("click", () => {
            infoWindow.setContent(
              buildInfoWindowContent(zone.id, latestOccupancyRef.current)
            );
            infoWindow.setPosition({ lat: zone.lat, lng: zone.lng });
            infoWindow.open({
              map,
              shouldFocus: false,
            });
          });

          return {
            zoneId: zone.id,
            circle,
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

      circlesRef.current.forEach((entry) => {
        entry.circle.setMap(null);
      });
      circlesRef.current = [];

      infoWindowRef.current?.close();
      infoWindowRef.current = null;

      mutationObserverRef.current?.disconnect();
      mutationObserverRef.current = null;

      mapRef.current?.unbindAll();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (circlesRef.current.length === 0) {
      return;
    }

    circlesRef.current.forEach((entry) => {
      entry.circle.setOptions(
        getZoneCircleOptions(
          entry.zoneId,
          occupancyData,
          activeTargetZoneIds.includes(entry.zoneId)
        )
      );
    });
  }, [activeTargetZoneIds, occupancyData]);

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
    const description =
      mapError === "missing-api-key"
        ? "Google Maps API key not configured. Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local"
        : "Map could not be loaded. Check Google Maps API setup and network access.";

    return (
      <section className="nb-card bg-card p-4">
        <EmptyState
          icon={Map}
          title="Map unavailable"
          description={description}
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
