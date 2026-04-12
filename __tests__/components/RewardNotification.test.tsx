import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RewardNotification } from "@/components/attendee/RewardNotification";
import type { Challenge } from "@/types/firebase";

const confettiMock = vi.hoisted(() => vi.fn());
const logVenueAnalyticsEventMock = vi.hoisted(() => vi.fn());

vi.mock("canvas-confetti", () => ({
  default: confettiMock,
}));

vi.mock("@/lib/firebase/analytics", () => ({
  logVenueAnalyticsEvent: logVenueAnalyticsEventMock,
}));

function createChallenge(): Challenge {
  return {
    id: "challenge-1",
    eventId: "event-1",
    title: "Spread Out",
    description: "Move zones",
    targetSpreadPercentage: 70,
    targetZoneCount: 3,
    durationMinutes: 10,
    startTime: {} as Challenge["startTime"],
    endTime: {} as Challenge["endTime"],
    status: "completed",
    reward: {
      type: "Food Credit",
      description: "Free snacks",
      unlockedAt: null,
    },
    participatingTeamIds: ["team-1"],
  };
}

const storageStore: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => storageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    storageStore[key] = value;
  },
  removeItem: (key: string) => {
    delete storageStore[key];
  },
  clear: () => {
    Object.keys(storageStore).forEach((key) => delete storageStore[key]);
  },
  get length() {
    return Object.keys(storageStore).length;
  },
  key: (index: number) => Object.keys(storageStore)[index] ?? null,
};

Object.defineProperty(window, "localStorage", {
  value: mockStorage,
  writable: true,
});

describe("RewardNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <RewardNotification challenge={createChallenge()} open={false} onDismiss={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("logs reward analytics when opened", () => {
    render(
      <RewardNotification challenge={createChallenge()} open onDismiss={vi.fn()} />
    );

    expect(logVenueAnalyticsEventMock).toHaveBeenCalledWith("reward_unlocked", {
      challengeId: "challenge-1",
      rewardType: "Food Credit",
    });
    expect(screen.getByText("Free snacks")).toBeInTheDocument();
    expect(confettiMock).toHaveBeenCalled();
  });

  it("dismiss button stores seen flag and calls callback", () => {
    const onDismiss = vi.fn();

    render(
      <RewardNotification challenge={createChallenge()} open onDismiss={onDismiss} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Got it!" }));

    expect(window.localStorage.getItem("pulse_seen_reward_challenge-1")).toBe("1");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto dismisses after timeout", () => {
    vi.useFakeTimers();

    const onDismiss = vi.fn();

    render(
      <RewardNotification challenge={createChallenge()} open onDismiss={onDismiss} />
    );

    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
