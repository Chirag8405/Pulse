import { NextRequest, NextResponse } from "next/server";
import { VENUE_NAME } from "@/constants";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { apiLogger } from "@/lib/google/logging";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { logAuditEvent } from "@/lib/server/auditLog";
import { rateLimitHeaders } from "@/lib/server/rateLimit";
import { checkServerRateLimit } from "@/lib/server/rateLimitServer";
import { getBearerToken, isAdminLikeValue } from "@/lib/shared/authUtils";

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

function getNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function hasExistingAdminFlag(existingData: Partial<UserBootstrapDoc> | null): boolean {
  if (!existingData) {
    return false;
  }

  if (isAdminLikeValue(existingData.isAdmin)) {
    return true;
  }

  const legacyData = existingData as LegacyUserRoleDoc;

  return (
    isAdminLikeValue(legacyData.role) ||
    isAdminLikeValue(legacyData.admin) ||
    isAdminLikeValue(legacyData.is_admin) ||
    isAdminLikeValue(legacyData["is admin"])
  );
}

function hasAdminClaim(decodedToken: AdminClaims): boolean {
  if (isAdminLikeValue(decodedToken.admin) || isAdminLikeValue(decodedToken.isAdmin)) {
    return true;
  }

  return isAdminLikeValue(decodedToken.role);
}

async function tryClaimFirstAdmin(uid: string): Promise<boolean> {
  const firstAdminClaimReference = adminDb
    .collection("meta")
    .doc("first-admin-claim");

  try {
    await firstAdminClaimReference.create({
      uid,
      claimedAt: new Date(),
    });

    return true;
  } catch {
    return false;
  }
}

async function getLegacyUserByEmail(
  email: string | null | undefined,
  uid: string
): Promise<Partial<UserBootstrapDoc> | null> {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const usersCollection = adminDb.collection("users");

  const emailDocSnapshot = await usersCollection.doc(normalizedEmail).get();
  if (emailDocSnapshot.exists && emailDocSnapshot.id !== uid) {
    return emailDocSnapshot.data() as Partial<UserBootstrapDoc>;
  }

  const candidateEmails = new Set([email, normalizedEmail]);

  for (const candidateEmail of candidateEmails) {
    const querySnapshot = await usersCollection
      .where("email", "==", candidateEmail)
      .limit(1)
      .get();

    const legacyDocSnapshot = querySnapshot.docs.find((doc) => doc.id !== uid);
    if (legacyDocSnapshot) {
      return legacyDocSnapshot.data() as Partial<UserBootstrapDoc>;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let decodedToken: {
    uid: string;
    email?: string;
    name?: string;
    picture?: string;
    [key: string]: unknown;
  };

  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  try {
    const rateCheck = await checkServerRateLimit(
      `bootstrap:${decodedToken.uid}`,
      30,
      60_000
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(rateCheck) }
      );
    }

    const uid = decodedToken.uid;
    const normalizedEmail = (decodedToken.email ?? "").trim().toLowerCase();
    const allowlistedAdmin = normalizedEmail.length > 0 && ADMIN_EMAILS.has(normalizedEmail);
    const claimAdmin = hasAdminClaim(decodedToken as AdminClaims);

    const userReference = adminDb.collection("users").doc(uid);
    const userSnapshot = await userReference.get();

    if (userSnapshot.exists) {
      const existingData = userSnapshot.data() as Partial<UserBootstrapDoc>;
      const existingAdmin = hasExistingAdminFlag(existingData);
      const shouldPromoteToAdmin = !existingAdmin && (allowlistedAdmin || claimAdmin);
      const resolvedIsAdmin = existingAdmin || shouldPromoteToAdmin;
      const resolvedTeamId =
        typeof existingData.teamId === "string" ? existingData.teamId : null;

      const safeProfilePayload = {
        email: decodedToken.email ?? null,
        displayName: decodedToken.name ?? null,
        photoURL: decodedToken.picture ?? null,
        isAdmin: resolvedIsAdmin,
      };

      if (process.env.NODE_ENV === "development") {
        apiLogger.debug("Bootstrap existing user admin resolution", {
          uid,
          email: normalizedEmail || null,
          existingAdmin,
          allowlistedAdmin,
          claimAdmin,
          shouldPromoteToAdmin,
          resolvedIsAdmin,
        });
      }

      await userReference.set(safeProfilePayload, { merge: true });

      if (shouldPromoteToAdmin) {
        logAuditEvent("user.promoted_admin", uid, {
          metadata: { email: normalizedEmail || null },
        });
      }

      apiLogger.info("Bootstrap: existing user synced", { uid, isAdmin: resolvedIsAdmin });

      return NextResponse.json({
        isAdmin: resolvedIsAdmin,
        teamId: resolvedTeamId,
      });
    }

    const legacyData = await getLegacyUserByEmail(decodedToken.email, uid);
    const existingAdmin = hasExistingAdminFlag(legacyData);

    let firstUserAdmin = false;
    if (!existingAdmin && !allowlistedAdmin && !claimAdmin && AUTO_BOOTSTRAP_FIRST_ADMIN) {
      const adminSnapshot = await adminDb
        .collection("users")
        .where("isAdmin", "==", true)
        .limit(1)
        .get();

      if (adminSnapshot.empty) {
        firstUserAdmin = await tryClaimFirstAdmin(uid);
      }
    }

    const isAdmin = existingAdmin || allowlistedAdmin || firstUserAdmin || claimAdmin;

    const newUserPayload: UserBootstrapDoc = {
      uid,
      email: decodedToken.email ?? legacyData?.email ?? null,
      displayName: decodedToken.name ?? legacyData?.displayName ?? null,
      photoURL: decodedToken.picture ?? legacyData?.photoURL ?? null,
      teamId: legacyData?.teamId ?? null,
      venueId: legacyData?.venueId ?? VENUE_NAME,
      joinedAt: legacyData?.joinedAt ?? new Date(),
      totalPoints: getNumber(legacyData?.totalPoints),
      totalChallengesCompleted: getNumber(legacyData?.totalChallengesCompleted),
      isAdmin,
    };

    if (process.env.NODE_ENV === "development") {
      apiLogger.debug("Bootstrap new user admin resolution", {
        uid,
        email: normalizedEmail || null,
        existingAdmin,
        allowlistedAdmin,
        claimAdmin,
        firstUserAdmin,
        resolvedIsAdmin: newUserPayload.isAdmin,
      });
    }

    await userReference.set(newUserPayload, { merge: true });

    logAuditEvent("user.created", uid, {
      metadata: { email: normalizedEmail || null, isAdmin },
    });

    apiLogger.info("Bootstrap: new user created", { uid, isAdmin });

    return NextResponse.json({
      isAdmin,
      teamId: newUserPayload.teamId,
    });
  } catch (error) {
    return internalApiErrorResponse(
      "Failed to bootstrap user",
      error,
      "Bootstrap user API failed"
    );
  }
}
