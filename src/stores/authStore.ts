import type { User as FirebaseUser } from "firebase/auth";
import { create } from "zustand";
import type { User } from "@/types/firebase";

interface AuthState {
  user: FirebaseUser | null;
  firestoreUser: User | null;
  loading: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setFirestoreUser: (firestoreUser: User | null) => void;
  setLoading: (loading: boolean) => void;
  setIsAuthReady: (isAuthReady: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firestoreUser: null,
  loading: true,
  isAuthReady: false,
  isAdmin: false,
  setUser: (user) => {
    if (!user) {
      set({
        user: null,
        firestoreUser: null,
        isAdmin: false,
      });
      return;
    }

    set({ user });
  },
  setFirestoreUser: (firestoreUser) => {
    set({
      firestoreUser,
      isAdmin: firestoreUser?.isAdmin === true,
    });
  },
  setLoading: (loading) => {
    set({ loading });
  },
  setIsAuthReady: (isAuthReady) => {
    set({ isAuthReady });
  },
}));
