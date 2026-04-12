import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import {
  type Firestore,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const NON_PROD_FIREBASE_DEFAULTS: Readonly<Record<string, string>> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "dev-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "dev-auth-domain.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "dev-project-id",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "dev-project-id.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "1234567890",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:1234567890:web:abcdef123456",
};

function requireEnvVar(name: string): string {
  const value = process.env[name];

  if (value) {
    return value;
  }

  // Keep production strict while allowing local/test runs to boot with
  // deterministic dummy values used only for mock-auth and non-prod testing.
  if (process.env.NODE_ENV !== "production") {
    return NON_PROD_FIREBASE_DEFAULTS[name] ?? `dev-${name.toLowerCase()}`;
  }

  throw new Error(
    `Missing required environment variable: ${name}. ` +
    `Add it to .env.local (see .env.example for reference).`
  );
}

const firebaseConfig = {
  apiKey: requireEnvVar("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: requireEnvVar("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: requireEnvVar("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: requireEnvVar("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnvVar("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireEnvVar("NEXT_PUBLIC_FIREBASE_APP_ID"),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const shouldInitializeAnalytics =
  typeof window !== "undefined" &&
  Boolean(firebaseConfig.measurementId) &&
  (process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_ENABLE_FIREBASE_ANALYTICS === "true");

const shouldUsePersistentFirestoreCache =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_ENABLE_FIRESTORE_PERSISTENCE === "true";

const shouldForceLongPollingTransport =
  typeof window !== "undefined" &&
  (process.env.NEXT_PUBLIC_FIREBASE_FORCE_LONG_POLLING === "true" ||
    process.env.NODE_ENV === "development");

export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth | null =
  typeof window !== "undefined" ? getAuth(app) : null;

function createFirestore(): Firestore {
  if (typeof window === "undefined") {
    return getFirestore(app);
  }

  try {
    return initializeFirestore(app, {
      localCache: shouldUsePersistentFirestoreCache
        ? persistentLocalCache({
            tabManager: persistentSingleTabManager(undefined),
          })
        : memoryLocalCache(),
      ...(shouldForceLongPollingTransport
        ? {
            experimentalForceLongPolling: true,
            useFetchStreams: false,
          }
        : {}),
    });
  } catch {
    // Hot reload can re-enter this module after Firestore has been initialized.
    return getFirestore(app);
  }
}

export const db: Firestore = createFirestore();

export const analyticsPromise: Promise<Analytics | null> =
  !shouldInitializeAnalytics
    ? Promise.resolve(null)
    : isSupported()
        .then((supported) => (supported ? getAnalytics(app) : null))
        .catch(() => null);
