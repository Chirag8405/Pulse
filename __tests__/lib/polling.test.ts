import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startAdaptivePolling } from "@/lib/shared/polling";

describe("startAdaptivePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("runs immediately and then on the configured interval", async () => {
    const runMock = vi.fn().mockResolvedValue(undefined);

    const stop = startAdaptivePolling({
      intervalMs: 2_000,
      run: runMock,
    });

    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(2);

    stop();
  });

  it("slows polling in hidden tabs and refreshes immediately when visible", async () => {
    const runMock = vi.fn().mockResolvedValue(undefined);

    const stop = startAdaptivePolling({
      intervalMs: 1_000,
      run: runMock,
    });

    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    vi.advanceTimersByTime(3_000);
    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_000);
    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    expect(runMock).toHaveBeenCalledTimes(3);

    stop();
  });

  it("does not start a new run while a poll tick is in flight", async () => {
    let resolveTick: (() => void) | undefined;
    const runMock = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve;
        })
    );

    const stop = startAdaptivePolling({
      intervalMs: 1_000,
      run: runMock,
    });

    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4_000);
    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(1);

    resolveTick?.();
    await Promise.resolve();

    vi.advanceTimersByTime(1_000);
    await Promise.resolve();
    expect(runMock).toHaveBeenCalledTimes(2);

    stop();
  });
});
