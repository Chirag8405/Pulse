import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createLogger } from "@/lib/google/logging";

describe("createLogger", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a logger with the given component name", () => {
    const logger = createLogger("test-component");

    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.critical).toBe("function");
  });

  it("calls console.debug for debug level", () => {
    const logger = createLogger("api");
    logger.debug("debug message");

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      "[api]",
      "debug message"
    );
  });

  it("calls console.log for info level", () => {
    const logger = createLogger("api");
    logger.info("info message");

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[api]",
      "info message"
    );
  });

  it("calls console.warn for warn level", () => {
    const logger = createLogger("api");
    logger.warn("warning message");

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[api]",
      "warning message"
    );
  });

  it("calls console.error for error level", () => {
    const logger = createLogger("api");
    logger.error("error message");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[api]",
      "error message"
    );
  });

  it("calls console.error for critical level", () => {
    const logger = createLogger("api");
    logger.critical("critical message");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[api]",
      "critical message"
    );
  });

  it("includes extra data when provided", () => {
    const logger = createLogger("api");
    logger.info("message with data", { userId: "abc", eventId: "evt-1" });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[api]",
      "message with data",
      { userId: "abc", eventId: "evt-1" }
    );
  });

  it("omits extra data when empty", () => {
    const logger = createLogger("api");
    logger.info("simple message");

    expect(consoleLogSpy).toHaveBeenCalledWith("[api]", "simple message");
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });
});
