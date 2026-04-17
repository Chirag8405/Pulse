import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

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

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/login?redirect=%2Fdashboard%3Ftab%3Doverview"
    );
    expect(nonce).toMatch(/^[a-f0-9]{32}$/i);
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(styleSrc).toContain(`'nonce-${nonce}'`);
    expect(styleSrc).not.toContain("'unsafe-inline'");
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
