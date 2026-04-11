import {
  type Auth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithPopup,
  signInWithRedirect,
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

  document.cookie = `${SESSION_COOKIE_NAME}=1; Path=/; Max-Age=86400; SameSite=Lax${secureAttribute}`;
}

function clearSessionCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function signInWithGoogle(): Promise<void> {
  const authClient = requireAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope("profile");
  provider.addScope("email");

  const isLocalhost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (isLocalhost) {
    const credential = await signInWithPopup(authClient, provider);
    if (credential.user) {
      setSessionCookie();
    }
    return;
  }

  await signInWithRedirect(authClient, provider);
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
