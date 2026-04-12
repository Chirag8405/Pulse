import { describe, expect, it, vi } from "vitest";

vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    user: null,
    firestoreUser: null,
    loading: true,
    isAuthReady: false,
    isAdmin: false,
    setUser: vi.fn(),
    setFirestoreUser: vi.fn(),
    setLoading: vi.fn(),
    setIsAuthReady: vi.fn(),
  })),
}));

import { useAuthStore } from "@/stores/authStore";

describe("authStore", () => {
  it("returns initial state", () => {
    const state = vi.mocked(useAuthStore)();

    expect(state.user).toBeNull();
    expect(state.firestoreUser).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.isAuthReady).toBe(false);
    expect(state.isAdmin).toBe(false);
  });

  it("has all required methods", () => {
    const state = vi.mocked(useAuthStore)();

    expect(typeof state.setUser).toBe("function");
    expect(typeof state.setFirestoreUser).toBe("function");
    expect(typeof state.setLoading).toBe("function");
    expect(typeof state.setIsAuthReady).toBe("function");
  });
});
