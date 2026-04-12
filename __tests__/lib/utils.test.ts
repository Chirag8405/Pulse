import { describe, expect, it } from "vitest";
import { haversineDistance, getNearestZone, formatCountdown, seatToTeam } from "@/lib/utils";

describe("haversineDistance", () => {
  it("returns 0 for same coordinates", () => {
    const coord = { lat: 18.9388, lng: 72.8252 };
    expect(haversineDistance(coord, coord)).toBe(0);
  });

  it("returns approximate distance between two known points", () => {
    const wankhede = { lat: 18.9388, lng: 72.8252 };
    const nearby = { lat: 18.9392, lng: 72.8252 };
    const distance = haversineDistance(wankhede, nearby);
    // ~44 meters apart
    expect(distance).toBeGreaterThan(30);
    expect(distance).toBeLessThan(60);
  });
});

describe("getNearestZone", () => {
  it("returns North Stand for coordinates closest to it", () => {
    const zone = getNearestZone({ lat: 18.9392, lng: 72.8252 });
    expect(zone.id).toBe("zone-north");
  });

  it("returns South Stand for southern coordinates", () => {
    const zone = getNearestZone({ lat: 18.9384, lng: 72.8252 });
    expect(zone.id).toBe("zone-south");
  });

  it("always returns a zone", () => {
    const zone = getNearestZone({ lat: 0, lng: 0 });
    expect(zone).toBeDefined();
    expect(zone.id).toBeTruthy();
  });
});

describe("formatCountdown", () => {
  it("formats 125 seconds as 2:05", () => {
    expect(formatCountdown(125)).toBe("2:05");
  });

  it("formats 0 as 0:00", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("clamps negative values to 0:00", () => {
    expect(formatCountdown(-10)).toBe("0:00");
  });

  it("formats 60 seconds as 1:00", () => {
    expect(formatCountdown(60)).toBe("1:00");
  });

  it("floors fractional seconds", () => {
    expect(formatCountdown(61.9)).toBe("1:01");
  });
});

describe("seatToTeam", () => {
  it("throws for empty string", () => {
    expect(() => seatToTeam("")).toThrow("Seat is required");
  });

  it("returns null for invalid section format", () => {
    expect(seatToTeam("Z-1-1")).toBeNull();
  });

  it("returns null for numeric-only section", () => {
    expect(seatToTeam("123-1-1")).toBeNull();
  });
});
