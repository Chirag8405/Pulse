import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock firebase/storage
vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve("https://storage.example.com/file.jpg")),
  listAll: vi.fn(() => Promise.resolve({ items: [], prefixes: [] })),
  deleteObject: vi.fn(() => Promise.resolve()),
}));

// Mock firebase config
vi.mock("@/lib/firebase/config", () => ({
  app: {},
}));

import { getDownloadURL, uploadBytes } from "firebase/storage";
import {
  uploadChallengeRewardImage,
} from "@/lib/firebase/storage";

describe("Firebase Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadChallengeRewardImage", () => {
    it("rejects files with invalid types", async () => {
      const file = new File(["data"], "test.txt", { type: "text/plain" });

      await expect(
        uploadChallengeRewardImage("challenge-1", file)
      ).rejects.toThrow("Invalid file type");
    });

    it("rejects files exceeding 5MB", async () => {
      // Create a fake large file
      const largeContent = new ArrayBuffer(6 * 1024 * 1024);
      const file = new File([largeContent], "big.jpg", { type: "image/jpeg" });

      await expect(
        uploadChallengeRewardImage("challenge-1", file)
      ).rejects.toThrow("exceeds the 5MB limit");
    });

    it("accepts valid JPEG files", async () => {
      const file = new File(["image-data"], "reward.jpg", {
        type: "image/jpeg",
      });

      const url = await uploadChallengeRewardImage("challenge-1", file);

      expect(url).toBe("https://storage.example.com/file.jpg");
      expect(uploadBytes).toHaveBeenCalled();
      expect(getDownloadURL).toHaveBeenCalled();
    });

    it("accepts valid PNG files", async () => {
      const file = new File(["image-data"], "reward.png", {
        type: "image/png",
      });

      const url = await uploadChallengeRewardImage("challenge-1", file);

      expect(url).toBe("https://storage.example.com/file.jpg");
    });

    it("accepts valid WebP files", async () => {
      const file = new File(["image-data"], "reward.webp", {
        type: "image/webp",
      });

      const url = await uploadChallengeRewardImage("challenge-1", file);

      expect(url).toBe("https://storage.example.com/file.jpg");
    });
  });
});
