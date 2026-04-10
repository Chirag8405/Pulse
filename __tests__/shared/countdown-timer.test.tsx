import { act, render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CountdownTimer } from "@/components/shared/CountdownTimer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-10T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onExpire when timer reaches zero", () => {
    const onExpire = vi.fn();

    render(
      <CountdownTimer
        endTime={new Date(Date.now() + 1_000)}
        onExpire={onExpire}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1_500);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
