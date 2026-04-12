import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

function buildScriptSourceDirective(): string {
  const unsafeEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

  return [
    `script-src 'self' 'unsafe-inline'${unsafeEval}`,
    "https://*.googleapis.com",
    "https://*.gstatic.com",
    "https://maps.googleapis.com",
    "https://apis.google.com",
    "https://www.googletagmanager.com",
  ].join(" ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              buildScriptSourceDirective(),
              buildScriptSourceDirective().replace("script-src", "script-src-elem"),
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://*.googleapis.com https://*.gstatic.com",
              "connect-src 'self' https://*.googleapis.com https://*.firebase.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com",
              "frame-src 'self' https://*.firebaseapp.com https://*.google.com https://apis.google.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default bundleAnalyzer(nextConfig);
