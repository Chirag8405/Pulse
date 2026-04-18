import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/challenges",
  "/join",
  "/leaderboard",
  "/profile",
] as const;

const scriptUnsafeEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

function createNonce(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function isJwtLikeValue(value: string): boolean {
  const segments = value.split(".");

  return segments.length === 3 && segments.every((segment) => segment.length > 0);
}

function hasUsableSessionCookie(request: NextRequest): boolean {
  const value = request.cookies.get("__session")?.value?.trim();

  if (!value) {
    return false;
  }

  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return isJwtLikeValue(value);
}

function buildSecurityHeaders(nonce: string): Readonly<Record<string, string>> {
  const scriptSourcePolicy =
    `'self' 'nonce-${nonce}' 'strict-dynamic'${scriptUnsafeEval} ` +
    "https://*.googleapis.com https://*.gstatic.com https://maps.googleapis.com https://apis.google.com https://www.googletagmanager.com";
  const styleSourcePolicy = `'self' 'nonce-${nonce}' https://fonts.googleapis.com`;
  const styleElementSourcePolicy = `'self' 'unsafe-inline' https://fonts.googleapis.com`;

  const headers: Record<string, string> = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    "Content-Security-Policy":
      `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; ` +
      `script-src ${scriptSourcePolicy}; script-src-elem ${scriptSourcePolicy}; script-src-attr 'none'; ` +
      `style-src ${styleSourcePolicy}; style-src-elem ${styleElementSourcePolicy}; style-src-attr 'unsafe-inline'; ` +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://*.googleapis.com https://*.gstatic.com; " +
      "connect-src 'self' https://*.googleapis.com https://*.firebase.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com; " +
      "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://apis.google.com",
  };

  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function withSecurityHeaders(
  response: NextResponse,
  securityHeaders: Readonly<Record<string, string>>,
  nonce: string
): NextResponse {
  for (const [header, value] of Object.entries(securityHeaders)) {
    response.headers.set(header, value);
  }

  response.headers.set("x-nonce", nonce);

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = hasUsableSessionCookie(request);
  const nonce = createNonce();
  const securityHeaders = buildSecurityHeaders(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);

  if (isProtectedPath(pathname) && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);

    return withSecurityHeaders(
      NextResponse.redirect(loginUrl),
      securityHeaders,
      nonce
    );
  }

  return withSecurityHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
    securityHeaders,
    nonce
  );
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};