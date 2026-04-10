import { describe, expect, it } from "vitest";
import { ZONES } from "@/constants";
import {
  formatCountdown,
  getNearestZone,
  haversineDistance,
  seatToTeam,
} from "@/lib/utils";

describe("utils", () => {
  it("haversineDistance computes Mumbai to Delhi in expected range", () => {
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const delhi = { lat: 28.7041, lng: 77.1025 };

    const distanceMeters = haversineDistance(mumbai, delhi);

    expect(distanceMeters).toBeGreaterThan(1_000_000);
    expect(distanceMeters).toBeLessThan(1_500_000);
  });

  it("haversineDistance returns zero for identical coordinates", () => {
    const point = { lat: 18.9388, lng: 72.8252 };

    expect(haversineDistance(point, point)).toBe(0);
  });

  it("getNearestZone resolves the expected zone for each zone centroid", () => {
    for (const zone of ZONES) {
      const nearestZone = getNearestZone({ lat: zone.lat, lng: zone.lng });
      expect(nearestZone.id).toBe(zone.id);
    }
  });

  it("formatCountdown formats key edge values", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(125)).toBe("2:05");
    expect(formatCountdown(3599)).toBe("59:59");
  });

  it("seatToTeam maps valid seat section to a team", () => {
    const team = seatToTeam("A-12-34");

    expect(team?.id).toBe("team-north-wolves");
  });

  it("seatToTeam returns null for unknown section", () => {
    expect(seatToTeam("X-99-99")).toBeNull();
  });

  it("seatToTeam throws for empty input", () => {
    expect(() => seatToTeam("")).toThrow();
  });
});
