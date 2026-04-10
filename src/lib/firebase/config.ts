import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import {
  getFirestore,
  enableIndexedDbPersistence,
  type FirestoreError,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyBOti4mM-6x9WDnZIjIeyEU21OpBXqWBgw",
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
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-DEMO123456",
};

export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth | null =
  typeof window !== "undefined" ? getAuth(app) : null;
export const db = getFirestore(app);

if (typeof window !== "undefined") {
  void enableIndexedDbPersistence(db).catch((error: FirestoreError) => {
    if (
      error.code === "failed-precondition" ||
      error.code === "unimplemented"
    ) {
      return;
    }

    console.error("Failed to enable Firestore offline persistence", error);
  });
}

export const analytics: Analytics | null =
  typeof window !== "undefined" ? getAnalytics(app) : null;
