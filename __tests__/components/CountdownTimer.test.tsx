import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CountdownTimer } from "@/components/shared/CountdownTimer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  test("renders MM:SS format", () => {
    act(() => {
      render(
        <CountdownTimer
          endTime={new Date(Date.now() + 125_000)}
          onExpire={() => undefined}
        />
      );
    });

    expect(screen.getByText("02:05")).toBeInTheDocument();
  });

  test("counts down by 1 each second", () => {
    act(() => {
      render(
        <CountdownTimer
          endTime={new Date(Date.now() + 3_000)}
          onExpire={() => undefined}
        />
      );
    });

    expect(screen.getByText("00:03")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(screen.getByText("00:02")).toBeInTheDocument();
  });

  test("calls onExpire when reaching 0", () => {
    const onExpire = vi.fn();

    act(() => {
      render(
        <CountdownTimer
          endTime={new Date(Date.now() + 1_000)}
          onExpire={onExpire}
        />
      );
    });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  test("applies warning class when < 120 seconds", () => {
    act(() => {
      render(
        <CountdownTimer
          endTime={new Date(Date.now() + 119_000)}
          onExpire={() => undefined}
        />
      );
    });

    const timerText = screen.getByText("01:59");
    expect(timerText).toHaveClass("text-amber-600");
  });

  test("cleans up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    let unmount: () => void = () => undefined;

    act(() => {
      const rendered = render(
        <CountdownTimer
          endTime={new Date(Date.now() + 10_000)}
          onExpire={() => undefined}
        />
      );
      unmount = rendered.unmount;
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
