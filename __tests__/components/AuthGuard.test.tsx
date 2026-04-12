import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/firebase/config", () => ({
  app: {},
  auth: null,
  db: {},
  analyticsPromise: Promise.resolve(null),
}));

vi.mock("@/lib/firebase/collections", () => ({
  usersCollection: {},
  teamsCollection: {},
  eventsCollection: {},
  challengesCollection: {},
  userDoc: vi.fn(),
  teamDoc: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    firestoreUser: null,
    loading: false,
    isAuthReady: true,
    error: null,
    isAdmin: false,
    isAuthenticated: false,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: vi.fn() })),
  usePathname: vi.fn(() => "/dashboard"),
}));

import { AuthGuard } from "@/components/layout/AuthGuard";

describe("AuthGuard", () => {
  it("renders nothing when not authenticated", () => {
    const { container } = render(
      <AuthGuard>
        <div>Protected</div>
      </AuthGuard>
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows AccessDenied for non-admin on admin routes", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "u1" } as import("firebase/auth").User,
      firestoreUser: null,
      loading: false,
      isAuthReady: true,
      error: null,
      isAdmin: false,
      isAuthenticated: true,
    });

    render(
      <AuthGuard requireAdmin>
        <div>Admin Content</div>
      </AuthGuard>
    );

    expect(screen.queryByText("Admin Content")).not.toBeInTheDocument();
  });

  it("renders children for authenticated user", async () => {
    const { useAuth } = await import("@/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "u1" } as import("firebase/auth").User,
      firestoreUser: null,
      loading: false,
      isAuthReady: true,
      error: null,
      isAdmin: false,
      isAuthenticated: true,
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
