import { describe, expect, it, vi, beforeEach } from "vitest";
import { getStaticMapUrl } from "@/lib/google/maps";

describe("Google Maps Service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  describe("getStaticMapUrl", () => {
    it("returns empty string when API key is not set", () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

      expect(getStaticMapUrl()).toBe("");
    });

    it("returns a valid URL when API key is set", () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";

      const url = getStaticMapUrl();

      expect(url).toContain("maps.googleapis.com");
      expect(url).toContain("test-api-key");
      expect(url).toContain("zoom=17");
      expect(url).toContain("maptype=satellite");
    });

    it("uses custom dimensions", () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";

      const url = getStaticMapUrl(800, 600);

      expect(url).toContain("size=800x600");
    });

    it("uses default dimensions", () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";

      const url = getStaticMapUrl();

      expect(url).toContain("size=600x400");
    });

    it("includes venue coordinates", () => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";

      const url = getStaticMapUrl();

      // Wankhede Stadium coordinates
      expect(url).toContain("18.9388");
      expect(url).toContain("72.8252");
    });
  });
});
