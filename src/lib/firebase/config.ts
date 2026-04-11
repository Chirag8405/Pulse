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

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "demo-firebase-api-key",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "demo-pulse.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-pulse",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-pulse.appspot.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:1234567890:web:1234567890abcdef123456",
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
