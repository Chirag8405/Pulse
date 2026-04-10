import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "pulse",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

// No auth required on this endpoint.
