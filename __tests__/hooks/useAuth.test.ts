import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const onAuthChangeMock = vi.hoisted(() => vi.fn());
const getOrCreateUserMock = vi.hoisted(() => vi.fn());
const setAnalyticsUserIdMock = vi.hoisted(() => vi.fn());
const setAnalyticsUserPropertiesMock = vi.hoisted(() => vi.fn());

const authHarness = vi.hoisted(() => ({
  callback: null as null | ((user: import("firebase/auth").User | null) => void),
}));

const storeHarness = vi.hoisted(() => ({
  user: null as import("firebase/auth").User | null,
  firestoreUser: null as unknown,
  loading: true,
  isAuthReady: false,
  isAdmin: false,
}));

const storeActions = vi.hoisted(() => ({
  setUser: vi.fn((user: import("firebase/auth").User | null) => {
    storeHarness.user = user;
  }),
  setFirestoreUser: vi.fn((firestoreUser: unknown) => {
    storeHarness.firestoreUser = firestoreUser;
    storeHarness.isAdmin = Boolean(
      (firestoreUser as { isAdmin?: boolean } | null)?.isAdmin
    );
  }),
  setLoading: vi.fn((loading: boolean) => {
    storeHarness.loading = loading;
  }),
  setIsAuthReady: vi.fn((isAuthReady: boolean) => {
    storeHarness.isAuthReady = isAuthReady;
  }),
}));

vi.mock("@/lib/firebase/auth", () => ({
  onAuthChange: onAuthChangeMock,
}));

vi.mock("@/lib/firebase/helpers", () => ({
  getOrCreateUser: getOrCreateUserMock,
}));

vi.mock("@/lib/firebase/analytics", () => ({
  setAnalyticsUserId: setAnalyticsUserIdMock,
  setAnalyticsUserProperties: setAnalyticsUserPropertiesMock,
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(
    (selector: (state: {
      user: import("firebase/auth").User | null;
      firestoreUser: unknown;
      loading: boolean;
      isAuthReady: boolean;
      isAdmin: boolean;
      setUser: typeof storeActions.setUser;
      setFirestoreUser: typeof storeActions.setFirestoreUser;
      setLoading: typeof storeActions.setLoading;
      setIsAuthReady: typeof storeActions.setIsAuthReady;
    }) => unknown) =>
      selector({
        user: storeHarness.user,
        firestoreUser: storeHarness.firestoreUser,
        loading: storeHarness.loading,
        isAuthReady: storeHarness.isAuthReady,
        isAdmin: storeHarness.isAdmin,
        setUser: storeActions.setUser,
        setFirestoreUser: storeActions.setFirestoreUser,
        setLoading: storeActions.setLoading,
        setIsAuthReady: storeActions.setIsAuthReady,
      })
  ),
}));

import { useAuth } from "@/hooks/useAuth";

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authHarness.callback = null;

    storeHarness.user = null;
    storeHarness.firestoreUser = null;
    storeHarness.loading = true;
    storeHarness.isAuthReady = false;
    storeHarness.isAdmin = false;

    onAuthChangeMock.mockImplementation(
      (callback: (user: import("firebase/auth").User | null) => void) => {
        authHarness.callback = callback;
        return vi.fn();
      }
    );

    getOrCreateUserMock.mockResolvedValue({
      uid: "user-1",
      teamId: "team-1",
      isAdmin: false,
    });
  });

  it("returns loading state initially", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("handles signed-out auth change and sets signed-out analytics properties", async () => {
    renderHook(() => useAuth());

    await waitFor(() => {
      expect(onAuthChangeMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      authHarness.callback?.(null);
    });

    expect(storeActions.setUser).toHaveBeenCalledWith(null);
    expect(storeActions.setFirestoreUser).toHaveBeenCalledWith(null);
    expect(setAnalyticsUserPropertiesMock).toHaveBeenCalledWith({
      role: "signed_out",
      teamId: null,
    });
  });

  it("hydrates firebase user and sets analytics identity/properties", async () => {
    renderHook(() => useAuth());

    await waitFor(() => {
      expect(onAuthChangeMock).toHaveBeenCalledTimes(1);
    });

    const firebaseUser = {
      uid: "user-1",
    } as import("firebase/auth").User;

    await act(async () => {
      authHarness.callback?.(firebaseUser);
    });

    await waitFor(() => {
      expect(getOrCreateUserMock).toHaveBeenCalledWith(firebaseUser);
    });

    expect(setAnalyticsUserIdMock).toHaveBeenCalledWith("user-1");
    expect(setAnalyticsUserPropertiesMock).toHaveBeenCalledWith({
      role: "attendee",
      teamId: "team-1",
    });
  });

  it("exposes stable hook shape", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current).toHaveProperty("user");
    expect(result.current).toHaveProperty("firestoreUser");
    expect(result.current).toHaveProperty("loading");
    expect(result.current).toHaveProperty("isAuthReady");
    expect(result.current).toHaveProperty("error");
    expect(result.current).toHaveProperty("isAdmin");
    expect(result.current).toHaveProperty("isAuthenticated");
  });
});
