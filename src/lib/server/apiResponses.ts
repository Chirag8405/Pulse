import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { apiLogger } from "@/lib/google/logging";
import { getErrorDetails } from "@/lib/shared/errorUtils";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export function createRequestId(): string {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function internalApiErrorResponse(
  publicMessage: string,
  error: unknown,
  context: string
): NextResponse {
  const requestId = createRequestId();
  const details = getErrorDetails(error);

  apiLogger.error(context, {
    requestId,
    errorName: details.name,
    errorMessage: details.message,
  });

  if (process.env.NODE_ENV !== "production" && details.stack) {
    apiLogger.debug(`${context} stack`, {
      requestId,
      stack: details.stack,
    });
  }

  return NextResponse.json(
    {
      error: publicMessage,
      requestId,
    },
    {
      status: 500,
      headers: NO_STORE_HEADERS,
    }
  );
}
