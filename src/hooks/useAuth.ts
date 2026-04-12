"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { onAuthChange } from "@/lib/firebase/auth";
import { getOrCreateUser } from "@/lib/firebase/helpers";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/firebase";

interface UseAuthResult {
  user: FirebaseUser | null;
  firestoreUser: User | null;
  loading: boolean;
  isAuthReady: boolean;
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
  const isAuthReady = useAuthStore((state) => state.isAuthReady);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const setUser = useAuthStore((state) => state.setUser);
  const setFirestoreUser = useAuthStore((state) => state.setFirestoreUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setIsAuthReady = useAuthStore((state) => state.setIsAuthReady);

  const [error, setError] = useState<string | null>(null);
  const [e2eAuth, setE2EAuth] = useState<PulseE2EAuthPayload | null>(null);
  const [hasResolvedE2EAuth, setHasResolvedE2EAuth] = useState(false);

  // Use refs for values that are used inside handleAuthChange's conditional
  // check to prevent re-render loops from stale closure deps.
  const userUidRef = useRef<string | null>(null);
  const isAuthReadyRef = useRef(false);
  const firestoreUserRef = useRef<User | null>(null);
  const isAdminRef = useRef(false);

  useEffect(() => {
    userUidRef.current = user?.uid ?? null;
  }, [user?.uid]);

  useEffect(() => {
    isAuthReadyRef.current = isAuthReady;
  }, [isAuthReady]);

  useEffect(() => {
    firestoreUserRef.current = firestoreUser;
  }, [firestoreUser]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  const handleAuthChange = useCallback(
    async (firebaseUser: FirebaseUser | null) => {
      setError(null);

      if (!firebaseUser) {
        setUser(null);
        setFirestoreUser(null);
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      // Avoid re-running expensive user hydration when auth state is already settled.
      if (
        userUidRef.current === firebaseUser.uid &&
        isAuthReadyRef.current &&
        (firestoreUserRef.current !== null || isAdminRef.current)
      ) {
        setUser(firebaseUser);
        return;
      }

      setUser(firebaseUser);
      setLoading(true);
      setIsAuthReady(false);

      try {
        const syncedUser = await getOrCreateUser(firebaseUser);
        setFirestoreUser(syncedUser);
      } catch (authError) {
        setFirestoreUser(null);
        setError(getErrorMessage(authError));
      } finally {
        setIsAuthReady(true);
        setLoading(false);
      }
    },
    [setFirestoreUser, setIsAuthReady, setLoading, setUser]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setE2EAuth((window as PulseE2EWindow).__PULSE_E2E_AUTH__ ?? null);
    setHasResolvedE2EAuth(true);
  }, []);

  useEffect(() => {
    if (!hasResolvedE2EAuth) {
      return;
    }

    if (e2eAuth) {
      return;
    }

    const unsubscribe = onAuthChange((firebaseUser) => {
      void handleAuthChange(firebaseUser);
    });

    return () => {
      unsubscribe();
    };
  }, [e2eAuth, handleAuthChange, hasResolvedE2EAuth]);

  if (!hasResolvedE2EAuth) {
    return {
      user: null,
      firestoreUser: null,
      loading: true,
      isAuthReady: false,
      error: null,
      isAdmin: false,
      isAuthenticated: false,
    };
  }

  if (e2eAuth) {
    return {
      user: { uid: e2eAuth.uid } as FirebaseUser,
      firestoreUser: null,
      loading: false,
      isAuthReady: true,
      error: null,
      isAdmin: e2eAuth.isAdmin ?? false,
      isAuthenticated: true,
    };
  }

  return {
    user,
    firestoreUser,
    loading: loading || !isAuthReady,
    isAuthReady,
    error,
    isAdmin,
    isAuthenticated: Boolean(user),
  };
}
