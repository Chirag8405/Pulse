import { describe, expect, it, vi, beforeEach } from "vitest";

const updateUserLocationMock = vi.hoisted(() => vi.fn());

vi.mock("@/constants", () => ({
  LOCATION_UPDATE_INTERVAL_MS: 30000,
  ZONES: [
    { id: "zone-north", name: "North Stand", capacity: 8000, lat: 18.9392, lng: 72.8252, gate: "Gate 1-2" },
    { id: "zone-south", name: "South Stand", capacity: 8000, lat: 18.9384, lng: 72.8252, gate: "Gate 5-6" },
  ],
}));

vi.mock("@/lib/firebase/helpers", () => ({
  updateUserLocation: updateUserLocationMock,
}));

vi.mock("@/lib/firebase/analytics", () => ({
  logVenueAnalyticsEvent: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  haversineDistance: vi.fn(() => 100),
}));

import { renderHook, act } from "@testing-library/react";
import { useLocationTracking } from "@/hooks/useLocationTracking";

// jsdom's localStorage stub may not have all methods — use a simple polyfill.
const storageStore: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => storageStore[key] ?? null,
  setItem: (key: string, value: string) => { storageStore[key] = value; },
  removeItem: (key: string) => { delete storageStore[key]; },
  clear: () => { Object.keys(storageStore).forEach((k) => delete storageStore[k]); },
  get length() { return Object.keys(storageStore).length; },
  key: (i: number) => Object.keys(storageStore)[i] ?? null,
};

Object.defineProperty(window, "localStorage", { value: mockStorage, writable: true });

describe("useLocationTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.clear();
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

  it("skipLocation sets mode to skipped", () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    act(() => {
      result.current.skipLocation();
    });

    expect(result.current.data.mode).toBe("skipped");
    expect(result.current.data.permissionDialogOpen).toBe(false);
    expect(mockStorage.getItem("pulse_location_permission")).toBe("skipped");
  });

  it("requestGps sets mode to gps", () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    act(() => {
      result.current.requestGps();
    });

    expect(result.current.data.mode).toBe("gps");
    expect(mockStorage.getItem("pulse_location_permission")).toBe("gps");
  });

  it("requestManual sets mode to manual and opens picker", () => {
    const { result } = renderHook(() =>
      useLocationTracking({ userId: "u1", teamId: "t1" })
    );

    act(() => {
      result.current.requestManual();
    });

    expect(result.current.data.mode).toBe("manual");
    expect(result.current.data.manualPickerOpen).toBe(true);
  });

  it("returns correct shape", () => {
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
