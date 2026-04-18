import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const initialNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

afterEach(() => {
  setNodeEnv(initialNodeEnv);
});

function readCsp(response: Response): string {
  return response.headers.get("Content-Security-Policy") ?? "";
}

describe("proxy security headers", () => {
  it("redirects unauthenticated protected routes and sets nonce-based CSP", () => {
    const request = new NextRequest(
      "http://localhost:3000/dashboard?tab=overview"
    );

    const response = proxy(request);
    const nonce = response.headers.get("x-nonce");
    const csp = readCsp(response);
    const scriptSrc =
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("script-src ")) ?? "";
    const styleSrc =
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("style-src ")) ?? "";
    const styleSrcAttr =
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("style-src-attr ")) ?? "";

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?redirect=%2Fdashboard%3Ftab%3Doverview"
    );
    expect(nonce).toMatch(/^[a-f0-9]{32}$/i);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(styleSrc).toContain(`'nonce-${nonce}'`);
    expect(styleSrc).not.toContain("'unsafe-inline'");
    expect(styleSrcAttr).toContain("'unsafe-inline'");
  });

  it("allows protected routes for authenticated users", () => {
    const request = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "__session=present",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("Content-Security-Policy")).toContain("script-src");
  });

  it("requires JWT-like session values for protected routes in production", () => {
    setNodeEnv("production");

    const weakCookieRequest = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "__session=present",
      },
    });

    const weakCookieResponse = proxy(weakCookieRequest);
    expect(weakCookieResponse.status).toBe(307);

    const jwtLikeCookieRequest = new NextRequest("http://localhost:3000/dashboard", {
      headers: {
        cookie: "__session=header.payload.signature",
      },
    });

    const jwtLikeCookieResponse = proxy(jwtLikeCookieRequest);
    expect(jwtLikeCookieResponse.status).toBe(200);
    expect(jwtLikeCookieResponse.headers.get("Strict-Transport-Security")).toContain(
      "max-age"
    );
  });

  it("uses matcher exclusions for api and prefetch requests", () => {
    expect(config.matcher).toEqual([
      {
        source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
        missing: [
          { type: "header", key: "next-router-prefetch" },
          { type: "header", key: "purpose", value: "prefetch" },
        ],
      },
    ]);
  });
});
