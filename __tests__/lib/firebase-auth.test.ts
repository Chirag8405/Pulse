import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInAnonymouslyMock = vi.hoisted(() => vi.fn());
const signInWithPopupMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const onAuthStateChangedMock = vi.hoisted(() => vi.fn());
const googleAuthProviderCtorMock = vi.hoisted(() => vi.fn(() => ({
  addScope: vi.fn(),
  setCustomParameters: vi.fn(),
})));

const mockAuthClient = vi.hoisted(() => ({
  currentUser: {
    getIdToken: vi.fn().mockResolvedValue("token-1"),
  },
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: googleAuthProviderCtorMock,
  onAuthStateChanged: onAuthStateChangedMock,
  signInAnonymously: signInAnonymouslyMock,
  signInWithPopup: signInWithPopupMock,
  signOut: signOutMock,
}));

vi.mock("@/lib/firebase/config", () => ({
  auth: mockAuthClient,
}));

import { onAuthChange, signInAnonymously, signOut } from "@/lib/firebase/auth";

describe("firebase auth session sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthClient.currentUser = {
      getIdToken: vi.fn().mockResolvedValue("token-1"),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signInAnonymously creates a server session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });

    vi.stubGlobal("fetch", fetchMock);

    signInAnonymouslyMock.mockResolvedValue({
      user: { uid: "anon-1" },
    });

    const user = await signInAnonymously();

    expect(user.uid).toBe("anon-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
      })
    );
  });

  it("signOut clears the server session", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });

    vi.stubGlobal("fetch", fetchMock);

    signOutMock.mockResolvedValue(undefined);

    await signOut();

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("onAuthChange syncs session create and clear events", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });

    vi.stubGlobal("fetch", fetchMock);

    onAuthStateChangedMock.mockImplementation(
      (_auth: unknown, callback: (user: { uid: string } | null) => void) => {
        callback({ uid: "user-1" });
        callback(null);
        return vi.fn();
      }
    );

    onAuthChange(() => undefined);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
