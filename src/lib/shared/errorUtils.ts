/**
 * Centralized error utility functions.
 * Eliminates duplicated getErrorMessage implementations across hooks and components.
 */

/**
 * Extracts a human-readable error message from an unknown thrown value.
 * Use throughout the app to avoid duplicating this pattern.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "An unexpected error occurred."
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}

/**
 * Type-safe error metadata extractor for structured logging.
 */
export function getErrorDetails(error: unknown): {
  message: string;
  name: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
    name: "UnknownError",
  };
}
