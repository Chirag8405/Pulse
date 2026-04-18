import {
  type Auth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

function requireAuth(): Auth {
  if (!auth) {
    throw new Error("Firebase Auth is only available in the browser.");
  }

  return auth;
}

interface SessionApiResponse {
  error?: string;
}

async function createServerSession(
  authClient: Auth,
  forceTokenRefresh: boolean
): Promise<void> {
  const currentUser = authClient.currentUser;

  if (!currentUser) {
    throw new Error("No signed-in account found.");
  }

  const token = await currentUser.getIdToken(forceTokenRefresh);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as
    | SessionApiResponse
    | null;
  throw new Error(payload?.error ?? "Failed to initialize secure session.");
}

async function clearServerSession(): Promise<void> {
  await fetch("/api/auth/session", {
    method: "DELETE",
    cache: "no-store",
  }).catch(() => null);
}

interface GoogleSignInOptions {
  forceAccountSelection?: boolean;
  clearExistingSession?: boolean;
}

export async function signInWithGoogle(
  options: GoogleSignInOptions = {}
): Promise<void> {
  const authClient = requireAuth();

  if (options.clearExistingSession && authClient.currentUser) {
    await firebaseSignOut(authClient);
    await clearServerSession();
  }

  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");

  if (options.forceAccountSelection) {
    provider.setCustomParameters({ prompt: "select_account" });
  }

  const credential = await signInWithPopup(authClient, provider);
  if (credential.user) {
    await createServerSession(authClient, true);
  }
}

export async function signInAnonymously(): Promise<FirebaseUser> {
  const authClient = requireAuth();
  const credential = await firebaseSignInAnonymously(authClient);
  await createServerSession(authClient, true);

  return credential.user;
}

export async function signOut(): Promise<void> {
  const authClient = requireAuth();

  try {
    await firebaseSignOut(authClient);
  } finally {
    await clearServerSession();
  }
}

export async function deleteAccount(): Promise<void> {
  const authClient = requireAuth();
  const currentUser = authClient.currentUser;

  if (!currentUser) {
    throw new Error("No signed-in account to delete.");
  }

  const token = await currentUser.getIdToken(true);

  const response = await fetch("/api/auth/delete-account", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Failed to delete account.");
  }

  try {
    await firebaseSignOut(authClient);
  } finally {
    await clearServerSession();
  }
}

export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  const authClient = requireAuth();

  return onAuthStateChanged(authClient, (user) => {
    if (user) {
      void createServerSession(authClient, false).catch(() => null);
    } else {
      void clearServerSession();
    }

    callback(user);
  });
}
