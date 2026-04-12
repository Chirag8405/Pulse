"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LOCATION_UPDATE_INTERVAL_MS, ZONES } from "@/constants";
import { updateUserLocation } from "@/lib/firebase/helpers";
import { logVenueAnalyticsEvent } from "@/lib/firebase/analytics";
import { getErrorMessage } from "@/lib/shared/errorUtils";
import { haversineDistance } from "@/lib/utils";

type LocationMode = "unset" | "gps" | "manual" | "skipped";

interface UseLocationTrackingInput {
  userId: string | null | undefined;
  teamId: string | null | undefined;
}

interface LocationTrackingData {
  mode: LocationMode;
  currentZoneId: string | null;
  permissionDialogOpen: boolean;
  manualPickerOpen: boolean;
}

interface UseLocationTrackingResult {
  data: LocationTrackingData;
  loading: boolean;
  error: string | null;
  requestGps: () => void;
  requestManual: () => void;
  skipLocation: () => void;
  selectManualZone: (zoneId: string) => Promise<void>;
  setManualPickerOpen: (open: boolean) => void;
}

const LOCATION_MODE_KEY = "pulse_location_permission";

const getLocationErrorMessage = (error: unknown) =>
  getErrorMessage(error, "Could not update your location.");

function getNearestZoneId(lat: number, lng: number): string {
  const nearestZone = ZONES.toSorted((left, right) => {
    const leftDistance = haversineDistance(
      { lat, lng },
      { lat: left.lat, lng: left.lng }
    );
    const rightDistance = haversineDistance(
      { lat, lng },
      { lat: right.lat, lng: right.lng }
    );

    return leftDistance - rightDistance;
  })[0];

  return nearestZone?.id ?? ZONES[0].id;
}

export function useLocationTracking({
  userId,
  teamId,
}: UseLocationTrackingInput): UseLocationTrackingResult {
  const [mode, setMode] = useState<LocationMode>("unset");
  const [currentZoneId, setCurrentZoneId] = useState<string | null>(null);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [manualPickerOpen, setManualPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTabVisible, setIsTabVisible] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const lastLocationPushAtRef = useRef(0);
  const currentZoneIdRef = useRef<string | null>(null);

  const persistMode = useCallback((nextMode: LocationMode) => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LOCATION_MODE_KEY, nextMode);
  }, []);

  const pushLocationUpdate = useCallback(
    async (zoneId: string, force: boolean = false) => {
      if (!userId || !teamId) {
        return;
      }

      const now = Date.now();
      const withinThrottleWindow =
        now - lastLocationPushAtRef.current < LOCATION_UPDATE_INTERVAL_MS;

      if (!force && withinThrottleWindow) {
        setCurrentZoneId(zoneId);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        lastLocationPushAtRef.current = now;
        setCurrentZoneId(zoneId);

        await updateUserLocation(userId, teamId, zoneId);

        if (currentZoneIdRef.current !== zoneId) {
          logVenueAnalyticsEvent("zone_changed", {
            zoneId,
            mode,
          });
        }

        currentZoneIdRef.current = zoneId;
      } catch (locationError) {
        setError(getLocationErrorMessage(locationError));
      } finally {
        setLoading(false);
      }
    },
    [mode, teamId, userId]
  );

  const requestGps = useCallback(() => {
    setMode("gps");
    setPermissionDialogOpen(false);
    setManualPickerOpen(false);
    persistMode("gps");
    logVenueAnalyticsEvent("location_permission_granted", {
      mode: "gps",
    });
  }, [persistMode]);

  const requestManual = useCallback(() => {
    setMode("manual");
    setPermissionDialogOpen(false);
    setManualPickerOpen(true);
    persistMode("manual");
    logVenueAnalyticsEvent("location_permission_granted", {
      mode: "manual",
    });
  }, [persistMode]);

  const skipLocation = useCallback(() => {
    setMode("skipped");
    setPermissionDialogOpen(false);
    setManualPickerOpen(false);
    persistMode("skipped");
    logVenueAnalyticsEvent("location_permission_denied", {
      mode: "skipped",
    });
  }, [persistMode]);

  const selectManualZone = useCallback(
    async (zoneId: string) => {
      setMode("manual");
      setManualPickerOpen(false);
      persistMode("manual");
      await pushLocationUpdate(zoneId, true);
    },
    [persistMode, pushLocationUpdate]
  );

  useEffect(() => {
    currentZoneIdRef.current = currentZoneId;
  }, [currentZoneId]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedMode = window.localStorage.getItem(LOCATION_MODE_KEY);

    if (storedMode === "gps" || storedMode === "manual" || storedMode === "skipped") {
      setMode(storedMode);
      setPermissionDialogOpen(false);
      setManualPickerOpen(storedMode === "manual");
      return;
    }

    setMode("unset");
    setPermissionDialogOpen(true);
    setManualPickerOpen(false);
  }, []);

  useEffect(() => {
    if (mode !== "gps" || !userId || !teamId || !isTabVisible) {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not available on this device.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nearestZoneId = getNearestZoneId(
          position.coords.latitude,
          position.coords.longitude
        );

        void pushLocationUpdate(nearestZoneId);
      },
      (geoError) => {
        setError(geoError.message);
      },
      {
        enableHighAccuracy: false,
        maximumAge: LOCATION_UPDATE_INTERVAL_MS,
        timeout: 15_000,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
    };
  }, [isTabVisible, mode, pushLocationUpdate, teamId, userId]);

  return {
    data: {
      mode,
      currentZoneId,
      permissionDialogOpen,
      manualPickerOpen,
    },
    loading,
    error,
    requestGps,
    requestManual,
    skipLocation,
    selectManualZone,
    setManualPickerOpen,
  };
}
