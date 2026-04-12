import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({
  Timestamp: { now: vi.fn(() => ({ toMillis: () => 0 })) },
  arrayUnion: vi.fn(),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  writeBatch: vi.fn(),
  where: vi.fn(),
}));

vi.mock("@/lib/firebase/collections", () => ({
  challengesCollection: "challengesCollection",
  eventsCollection: "eventsCollection",
  memberLocationDoc: vi.fn(),
  teamDoc: vi.fn(),
  teamProgressCollection: vi.fn(),
  teamProgressDoc: vi.fn(),
  userDoc: vi.fn(),
}));

vi.mock("@/lib/firebase/config", () => ({
  db: { id: "mock-db" },
}));

vi.mock("@/lib/firebase/auth", () => ({
  onAuthChange: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/firebase/helpers", () => ({
  getOrCreateUser: vi.fn(),
}));

vi.mock("@/lib/firebase/analytics", () => ({
  setAnalyticsUserId: vi.fn(),
  setAnalyticsUserProperties: vi.fn(),
}));

vi.mock("@/stores/authStore", () => {
  const state = {
    user: null as import("firebase/auth").User | null,
    firestoreUser: null,
    loading: true,
    isAuthReady: false,
    isAdmin: false,
    setUser: vi.fn((u: unknown) => { state.user = u as import("firebase/auth").User | null; }),
    setFirestoreUser: vi.fn(),
    setLoading: vi.fn(),
    setIsAuthReady: vi.fn(),
  };

  return {
    useAuthStore: vi.fn((selector: (s: typeof state) => unknown) => selector(state)),
  };
});

import { renderHook } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";

describe("useAuth", () => {
  it("returns loading state initially", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("returns correct shape", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("firestoreUser");
    expect(result.current).toHaveProperty("loading");
    expect(result.current).toHaveProperty("isAuthReady");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("isAdmin");
    expect(result.current).toHaveProperty("isAuthenticated");
  });

  it("error is null on initial render", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.error).toBeNull();
  });
});
