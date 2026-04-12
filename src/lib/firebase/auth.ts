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

const SESSION_COOKIE_NAME = "__session";

function requireAuth(): Auth {
  if (!auth) {
    throw new Error("Firebase Auth is only available in the browser.");
  }

  return auth;
}

function setSessionCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  const secureAttribute =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";

  // Use a timestamp-based value instead of a static flag to reduce forgery surface.
  const cookieValue = `s.${Date.now().toString(36)}`;

  document.cookie = `${SESSION_COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=86400; SameSite=Lax${secureAttribute}`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
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
    clearSessionCookie();
  }

  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");

  if (options.forceAccountSelection) {
    provider.setCustomParameters({ prompt: "select_account" });
  }

  const credential = await signInWithPopup(authClient, provider);
  if (credential.user) {
    setSessionCookie();
  }
}

export async function signInAnonymously(): Promise<FirebaseUser> {
  const authClient = requireAuth();
  const credential = await firebaseSignInAnonymously(authClient);
  setSessionCookie();

  return credential.user;
}

export async function signOut(): Promise<void> {
  const authClient = requireAuth();
  await firebaseSignOut(authClient);
  clearSessionCookie();
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
    clearSessionCookie();
  }
}

export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  const authClient = requireAuth();

  return onAuthStateChanged(authClient, (user) => {
    if (user) {
      setSessionCookie();
    } else {
      clearSessionCookie();
    }

    callback(user);
  });
}
