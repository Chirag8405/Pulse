/**
 * Firebase / Google Cloud Storage integration for venue assets.
 * Handles image upload, retrieval, and URL generation for
 * venue maps, team logos, and challenge reward media.
 */
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
  type FirebaseStorage,
  type StorageReference,
} from "firebase/storage";
import { app } from "@/lib/firebase/config";
import { getErrorMessage } from "@/lib/shared/errorUtils";

let storageInstance: FirebaseStorage | null = null;

/**
 * Lazily initializes and returns the Firebase Storage instance.
 * Only available in the browser context.
 */
export function getStorageInstance(): FirebaseStorage {
  if (typeof window === "undefined") {
    throw new Error("Firebase Storage is only available in the browser.");
  }

  if (!storageInstance) {
    storageInstance = getStorage(app);
  }

  return storageInstance;
}

/**
 * Uploads a venue asset (e.g., zone map image, team logo) to Cloud Storage.
 * Returns the public download URL.
 */
export async function uploadVenueAsset(
  path: string,
  file: Blob | Uint8Array | ArrayBuffer,
  contentType?: string
): Promise<string> {
  const storage = getStorageInstance();
  const storageRef = ref(storage, `venue-assets/${path}`);

  const metadata = contentType ? { contentType } : undefined;

  await uploadBytes(storageRef, file, metadata);

  return getDownloadURL(storageRef);
}

/**
 * Gets the download URL for a venue asset in Cloud Storage.
 */
export async function getVenueAssetUrl(path: string): Promise<string> {
  const storage = getStorageInstance();
  const storageRef = ref(storage, `venue-assets/${path}`);

  return getDownloadURL(storageRef);
}

/**
 * Lists all venue assets within a given directory path.
 */
export async function listVenueAssets(
  directoryPath: string
): Promise<StorageReference[]> {
  const storage = getStorageInstance();
  const directoryRef = ref(storage, `venue-assets/${directoryPath}`);

  const result = await listAll(directoryRef);

  return result.items;
}

/**
 * Deletes a venue asset from Cloud Storage.
 */
export async function deleteVenueAsset(path: string): Promise<void> {
  const storage = getStorageInstance();
  const storageRef = ref(storage, `venue-assets/${path}`);

  await deleteObject(storageRef);
}

/**
 * Uploads a challenge reward image with validation.
 * Max size: 5MB, accepted types: JPEG, PNG, WebP.
 */
export async function uploadChallengeRewardImage(
  challengeId: string,
  file: File
): Promise<string> {
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(
      `Invalid file type: ${file.type}. Accepted types: JPEG, PNG, WebP.`
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 5MB limit.`
    );
  }

  const extension = file.name.split(".").pop() ?? "jpg";
  const assetPath = `challenges/${challengeId}/reward.${extension}`;

  return uploadVenueAsset(assetPath, file, file.type);
}

/**
 * Safe wrapper for storage operations that returns null instead of throwing.
 */
export async function safeGetVenueAssetUrl(
  path: string
): Promise<string | null> {
  try {
    return await getVenueAssetUrl(path);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[storage] Failed to get venue asset URL for "${path}":`,
        getErrorMessage(error)
      );
    }

    return null;
  }
}
