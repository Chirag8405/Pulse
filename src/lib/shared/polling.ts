const DEFAULT_POLL_INTERVAL_MS = 5_000;
const MIN_POLL_INTERVAL_MS = 1_000;
const HIDDEN_TAB_INTERVAL_MULTIPLIER = 4;

export interface AdaptivePollingOptions {
  intervalMs?: number;
  run: () => Promise<void>;
  onError?: (error: unknown) => void;
}

function resolvePollInterval(intervalMs?: number): number {
  if (typeof intervalMs === "number" && Number.isFinite(intervalMs)) {
    return Math.max(MIN_POLL_INTERVAL_MS, Math.floor(intervalMs));
  }

  return DEFAULT_POLL_INTERVAL_MS;
}

export function startAdaptivePolling(options: AdaptivePollingOptions): () => void {
  const baseIntervalMs = resolvePollInterval(options.intervalMs);

  let active = true;
  let inFlight = false;
  let intervalId: number | null = null;

  const tick = async () => {
    if (!active || inFlight) {
      return;
    }

    inFlight = true;

    try {
      await options.run();
    } catch (error) {
      options.onError?.(error);
    } finally {
      inFlight = false;
    }
  };

  const getCurrentInterval = () => {
    if (typeof document !== "undefined" && document.hidden) {
      return baseIntervalMs * HIDDEN_TAB_INTERVAL_MULTIPLIER;
    }

    return baseIntervalMs;
  };

  const schedule = () => {
    if (!active || typeof window === "undefined") {
      return;
    }

    if (intervalId !== null) {
      window.clearInterval(intervalId);
    }

    intervalId = window.setInterval(() => {
      void tick();
    }, getCurrentInterval());
  };

  const handleVisibilityChange = () => {
    schedule();

    if (typeof document !== "undefined" && !document.hidden) {
      void tick();
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  void tick();
  schedule();

  return () => {
    active = false;

    if (intervalId !== null && typeof window !== "undefined") {
      window.clearInterval(intervalId);
    }

    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  };
}
