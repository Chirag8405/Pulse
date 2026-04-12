import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const updateUserLocationMock = vi.hoisted(() => vi.fn());
const logVenueAnalyticsEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/constants", () => ({
  LOCATION_UPDATE_INTERVAL_MS: 30000,
  ZONES: [
    {
      id: "zone-north",
      name: "North Stand",
      capacity: 8000,
      lat: 18.9392,
      lng: 72.8252,
      gate: "Gate 1-2",
    },
    {
      id: "zone-south",
      name: "South Stand",
      capacity: 8000,
      lat: 18.9384,
      lng: 72.8252,
      gate: "Gate 5-6",
    },
  ],
}));

vi.mock("@/lib/firebase/helpers", () => ({
  updateUserLocation: updateUserLocationMock,
}));

vi.mock("@/lib/firebase/analytics", () => ({
  logVenueAnalyticsEvent: logVenueAnalyticsEventMock,
}));

vi.mock("@/lib/utils", () => ({
  haversineDistance: vi.fn(() => 100),
}));

import { useLocationTracking } from "@/hooks/useLocationTracking";

const storageStore: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => storageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    storageStore[key] = value;
  },
  removeItem: (key: string) => {
    delete storageStore[key];
  },
  clear: () => {
    Object.keys(storageStore).forEach((key) => delete storageStore[key]);
  },
  get length() {
    return Object.keys(storageStore).length;
  },
  key: (index: number) => Object.keys(storageStore)[index] ?? null,
};

Object.defineProperty(window, "localStorage", {
  value: mockStorage,
  writable: true,
});

const watchPositionMock = vi.fn(
  (
    success: (position: { coords: { latitude: number; longitude: number } }) => void
  ) => {
    success({
      coords: {
        latitude: 18.9392,
        longitude: 72.8252,
      },
    });

    return 1;
  }
);

const clearWatchMock = vi.fn();

Object.defineProperty(window.navigator, "geolocation", {
  value: {
    watchPosition: watchPositionMock,
    clearWatch: clearWatchMock,
  },
  configurable: true,
});

describe("useLocationTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();

    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
  });

  it("returns initial unset mode when no stored preference", () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    expect(result.current.data.mode).toBe("unset");
    expect(result.current.data.permissionDialogOpen).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("restores GPS mode from localStorage", () => {
    mockStorage.setItem("pulse_location_permission", "gps");

    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    expect(result.current.data.mode).toBe("gps");
    expect(result.current.data.permissionDialogOpen).toBe(false);
  });

  it("restores manual mode from localStorage", () => {
    mockStorage.setItem("pulse_location_permission", "manual");

    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    expect(result.current.data.mode).toBe("manual");
    expect(result.current.data.manualPickerOpen).toBe(true);
  });

  it("logs permission analytics when selecting GPS/manual/skip", () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    act(() => {
      result.current.requestGps();
    });

    act(() => {
      result.current.requestManual();
    });

    act(() => {
      result.current.skipLocation();
    });

    expect(logVenueAnalyticsEventMock).toHaveBeenCalledWith(
      "location_permission_granted",
      { mode: "gps" }
    );
    expect(logVenueAnalyticsEventMock).toHaveBeenCalledWith(
      "location_permission_granted",
      { mode: "manual" }
    );
    expect(logVenueAnalyticsEventMock).toHaveBeenCalledWith(
      "location_permission_denied",
      { mode: "skipped" }
    );
  });

  it("selectManualZone updates Firestore location and tracks zone change", async () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    await act(async () => {
      await result.current.selectManualZone("zone-north");
    });

    expect(updateUserLocationMock).toHaveBeenCalledWith("u1", "t1", "zone-north");
    expect(logVenueAnalyticsEventMock).toHaveBeenCalledWith(
      "zone_changed",
      expect.objectContaining({ zoneId: "zone-north" })
    );
    expect(result.current.data.currentZoneId).toBe("zone-north");
  });

  it("starts GPS watch and pushes nearest zone update", async () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    act(() => {
      result.current.requestGps();
    });

    await waitFor(() => {
      expect(watchPositionMock).toHaveBeenCalled();
      expect(updateUserLocationMock).toHaveBeenCalledWith("u1", "t1", "zone-north");
    });
  });

  it("exposes stable return shape", () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: null, teamId: null })
    );

    expect(result.current).toHaveProperty("data");
    expect(result.current).toHaveProperty("loading");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("requestGps");
    expect(result.current).toHaveProperty("requestManual");
    expect(result.current).toHaveProperty("skipLocation");
    expect(result.current).toHaveProperty("selectManualZone");
    expect(result.current).toHaveProperty("setManualPickerOpen");
  });
});
