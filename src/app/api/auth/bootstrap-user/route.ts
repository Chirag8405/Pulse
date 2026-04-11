import { NextRequest, NextResponse } from "next/server";
import { VENUE_NAME } from "@/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

interface UserBootstrapDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  teamId: string | null;
  venueId: string;
  joinedAt: unknown;
  totalPoints: number;
  totalChallengesCompleted: number;
  isAdmin: boolean;
}

interface LegacyUserRoleDoc {
  role?: unknown;
  admin?: unknown;
  is_admin?: unknown;
  "is admin"?: unknown;
}

interface AdminClaims {
  admin?: unknown;
  isAdmin?: unknown;
  role?: unknown;
}

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const AUTO_BOOTSTRAP_FIRST_ADMIN = process.env.AUTO_BOOTSTRAP_FIRST_ADMIN !== "false";

function getBearerToken(request: NextRequest): string | null {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function hasAdminRoleValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase();

    return (
      normalizedValue === "admin" ||
      normalizedValue === "staff" ||
      normalizedValue === "true" ||
      normalizedValue === "1" ||
      normalizedValue === "yes"
    );
  }

  return false;
}

function hasExistingAdminFlag(existingData: Partial<UserBootstrapDoc> | null): boolean {
  if (!existingData) {
    return false;
  }

  if (hasAdminRoleValue(existingData.isAdmin)) {
    return true;
  }

  const legacyData = existingData as LegacyUserRoleDoc;

  return (
    hasAdminRoleValue(legacyData.role) ||
    hasAdminRoleValue(legacyData.admin) ||
    hasAdminRoleValue(legacyData.is_admin) ||
    hasAdminRoleValue(legacyData["is admin"])
  );
}

function hasAdminClaim(decodedToken: AdminClaims): boolean {
  if (hasAdminRoleValue(decodedToken.admin) || hasAdminRoleValue(decodedToken.isAdmin)) {
    return true;
  }

  return hasAdminRoleValue(decodedToken.role);
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const normalizedEmail = (decodedToken.email ?? "").trim().toLowerCase();

    const userReference = adminDb.collection("users").doc(uid);
    const userSnapshot = await userReference.get();
    const existingData = userSnapshot.exists
      ? (userSnapshot.data() as Partial<UserBootstrapDoc>)
      : null;

    const allowlistedAdmin = normalizedEmail.length > 0 && ADMIN_EMAILS.has(normalizedEmail);

    let firstUserAdmin = false;

    if (!allowlistedAdmin && AUTO_BOOTSTRAP_FIRST_ADMIN) {
      const adminSnapshot = await adminDb
        .collection("users")
        .where("isAdmin", "==", true)
        .limit(1)
        .get();
      firstUserAdmin = adminSnapshot.empty;
    }

    const claimAdmin = hasAdminClaim(decodedToken as AdminClaims);

    const isAdmin =
      hasExistingAdminFlag(existingData) || allowlistedAdmin || firstUserAdmin || claimAdmin;

    const payload: UserBootstrapDoc = {
      uid,
      email: decodedToken.email ?? existingData?.email ?? null,
      displayName: decodedToken.name ?? existingData?.displayName ?? null,
      photoURL: decodedToken.picture ?? existingData?.photoURL ?? null,
      teamId: existingData?.teamId ?? null,
      venueId: existingData?.venueId ?? VENUE_NAME,
      joinedAt: existingData?.joinedAt ?? new Date(),
      totalPoints: getNumber(existingData?.totalPoints),
      totalChallengesCompleted: getNumber(existingData?.totalChallengesCompleted),
      isAdmin,
    };

    await userReference.set(payload, { merge: true });

    return NextResponse.json({ isAdmin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";

    return NextResponse.json({ error: message }, { status: 401 });
  }
}
