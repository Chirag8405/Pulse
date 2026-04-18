import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { internalApiErrorResponse } from "@/lib/server/apiResponses";
import { rateLimitHeaders } from "@/lib/server/rateLimit";
import { checkServerRateLimit } from "@/lib/server/rateLimitServer";
import { getBearerToken } from "@/lib/shared/authUtils";

const SESSION_COOKIE_NAME = "__session";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
const SESSION_EXPIRES_IN_MS = SESSION_MAX_AGE_SECONDS * 1000;

function withNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function setSessionCookie(response: NextResponse, value: string): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  let uid = "";

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    uid = decodedToken.uid;
  } catch {
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }

  const rateCheck = await checkServerRateLimit(`session:create:${uid}`, 120, 60_000);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: rateLimitHeaders(rateCheck) }
    );
  }

  try {
    const sessionCookie = await adminAuth.createSessionCookie(token, {
      expiresIn: SESSION_EXPIRES_IN_MS,
    });

    return setSessionCookie(
      withNoStoreHeaders(NextResponse.json({ success: true })),
      sessionCookie
    );
  } catch (error) {
    return internalApiErrorResponse(
      "Failed to initialize secure session",
      error,
      "Session create API failed"
    );
  }
}

export async function DELETE(request: NextRequest) {
  const token = getBearerToken(request);

  if (token) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const rateCheck = await checkServerRateLimit(
        `session:clear:${decodedToken.uid}`,
        120,
        60_000
      );

      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: rateLimitHeaders(rateCheck) }
        );
      }
    } catch {
      // Ignore invalid tokens on sign-out and always clear any stale cookie.
    }
  }

  return clearSessionCookie(withNoStoreHeaders(NextResponse.json({ success: true })));
}
