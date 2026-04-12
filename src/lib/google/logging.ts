/**
 * Structured logging for Google Cloud (Cloud Run / Cloud Logging).
 * Produces JSON output compatible with Cloud Logging severity levels
 * so that logs are properly parsed in the Google Cloud Console.
 *
 * In development, falls back to console.* for readability.
 */

type LogSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

interface StructuredLogEntry {
  severity: LogSeverity;
  message: string;
  component?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";

function writeLog(entry: StructuredLogEntry): void {
  if (!isProduction) {
    const prefix = entry.component ? `[${entry.component}]` : "";

    const extra = Object.fromEntries(
      Object.entries(entry).filter(
        ([key]) => key !== "severity" && key !== "message" && key !== "component"
      )
    );

    const hasExtra = Object.keys(extra).length > 0;

    switch (entry.severity) {
      case "DEBUG":
        console.debug(prefix, entry.message, ...(hasExtra ? [extra] : []));
        break;
      case "WARNING":
        console.warn(prefix, entry.message, ...(hasExtra ? [extra] : []));
        break;
      case "ERROR":
      case "CRITICAL":
        console.error(prefix, entry.message, ...(hasExtra ? [extra] : []));
        break;
      default:
        console.log(prefix, entry.message, ...(hasExtra ? [extra] : []));
    }

    return;
  }

  // In production (Cloud Run), write structured JSON to stdout/stderr
  // for Cloud Logging ingestion.
  const logLine = JSON.stringify({
    ...entry,
    time: new Date().toISOString(),
  });

  if (entry.severity === "ERROR" || entry.severity === "CRITICAL") {
    process.stderr.write(logLine + "\n");
  } else {
    process.stdout.write(logLine + "\n");
  }
}

/**
 * Structured logger instance for a given component.
 */
export function createLogger(component: string) {
  return {
    debug: (message: string, extra?: Record<string, unknown>) =>
      writeLog({ severity: "DEBUG", message, component, ...extra }),

    info: (message: string, extra?: Record<string, unknown>) =>
      writeLog({ severity: "INFO", message, component, ...extra }),

    warn: (message: string, extra?: Record<string, unknown>) =>
      writeLog({ severity: "WARNING", message, component, ...extra }),

    error: (message: string, extra?: Record<string, unknown>) =>
      writeLog({ severity: "ERROR", message, component, ...extra }),

    critical: (message: string, extra?: Record<string, unknown>) =>
      writeLog({ severity: "CRITICAL", message, component, ...extra }),
  };
}

/**
 * Pre-built loggers for common components.
 */
export const apiLogger = createLogger("api");
export const authLogger = createLogger("auth");
export const realtimeLogger = createLogger("realtime");
export const storageLogger = createLogger("storage");
