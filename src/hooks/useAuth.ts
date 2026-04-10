"use client";

import { useCallback, useEffect, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthChange } from "@/lib/firebase/auth";
import { getOrCreateUser } from "@/lib/firebase/helpers";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/firebase";

interface UseAuthResult {
  user: FirebaseUser | null;
  firestoreUser: User | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Authentication failed";
}

interface PulseE2EAuthPayload {
  uid: string;
  isAdmin?: boolean;
}

interface PulseE2EWindow extends Window {
  __PULSE_E2E_AUTH__?: PulseE2EAuthPayload;
}

export function useAuth(): UseAuthResult {
  const user = useAuthStore((state) => state.user);
  const firestoreUser = useAuthStore((state) => state.firestoreUser);
  const loading = useAuthStore((state) => state.loading);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const setUser = useAuthStore((state) => state.setUser);
  const setFirestoreUser = useAuthStore((state) => state.setFirestoreUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  const [error, setError] = useState<string | null>(null);

  const e2eAuth =
    typeof window !== "undefined"
      ? ((window as PulseE2EWindow).__PULSE_E2E_AUTH__ ?? null)
      : null;

  const handleAuthChange = useCallback(
    async (firebaseUser: FirebaseUser | null) => {
      setError(null);
      setUser(firebaseUser);

      if (!firebaseUser) {
        setFirestoreUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const syncedUser = await getOrCreateUser(firebaseUser);
        setFirestoreUser(syncedUser);
      } catch (authError) {
        setFirestoreUser(null);
        setError(getErrorMessage(authError));
      } finally {
        setLoading(false);
      }
    },
    [setFirestoreUser, setLoading, setUser]
  );

  useEffect(() => {
    if (e2eAuth) {
      return;
    }

    setLoading(true);

    const unsubscribe = onAuthChange((firebaseUser) => {
      void handleAuthChange(firebaseUser);
    });

    return () => {
      unsubscribe();
    };
  }, [e2eAuth, handleAuthChange, setLoading]);

  if (e2eAuth) {
    return {
      user: { uid: e2eAuth.uid } as FirebaseUser,
      firestoreUser: null,
      loading: false,
      error: null,
      isAdmin: e2eAuth.isAdmin ?? false,
      isAuthenticated: true,
    };
  }

  return {
    user,
    firestoreUser,
    loading,
    error,
    isAdmin,
    isAuthenticated: Boolean(user),
  };
}
