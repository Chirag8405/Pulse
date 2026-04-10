import type { User as FirebaseUser } from "firebase/auth";
import { create } from "zustand";
import type { User } from "@/types/firebase";

interface AuthState {
  user: FirebaseUser | null;
  firestoreUser: User | null;
  loading: boolean;
  isAdmin: boolean;
  setUser: (user: FirebaseUser | null) => void;
  setFirestoreUser: (firestoreUser: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firestoreUser: null,
  loading: true,
  isAdmin: false,
  setUser: (user) => {
    set({ user });
  },
  setFirestoreUser: (firestoreUser) => {
    set({
      firestoreUser,
      isAdmin: firestoreUser?.isAdmin ?? false,
    });
  },
  setLoading: (loading) => {
    set({ loading });
  },
}));
