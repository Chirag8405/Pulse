import { describe, expect, it, beforeEach } from "vitest";
import { useOnboardingStore } from "@/stores/onboardingStore";

describe("onboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.getState().resetOnboarding();
  });

  it("starts at step 1 with forward direction", () => {
    const state = useOnboardingStore.getState();

    expect(state.step).toBe(1);
    expect(state.direction).toBe("forward");
    expect(state.seatInput).toBe("");
    expect(state.selectedTeamId).toBeNull();
  });

  it("advances to next step", () => {
    useOnboardingStore.getState().goToNextStep();
    const state = useOnboardingStore.getState();

    expect(state.step).toBe(2);
    expect(state.direction).toBe("forward");
  });

  it("goes to step 3", () => {
    useOnboardingStore.getState().goToNextStep();
    useOnboardingStore.getState().goToNextStep();
    const state = useOnboardingStore.getState();

    expect(state.step).toBe(3);
  });

  it("does not go beyond step 3", () => {
    useOnboardingStore.getState().goToNextStep();
    useOnboardingStore.getState().goToNextStep();
    useOnboardingStore.getState().goToNextStep();
    const state = useOnboardingStore.getState();

    expect(state.step).toBe(3);
  });

  it("goes to previous step", () => {
    useOnboardingStore.getState().goToNextStep();
    useOnboardingStore.getState().goToNextStep();
    useOnboardingStore.getState().goToPreviousStep();
    const state = useOnboardingStore.getState();

    expect(state.step).toBe(2);
    expect(state.direction).toBe("back");
  });

  it("does not go below step 1", () => {
    useOnboardingStore.getState().goToPreviousStep();
    const state = useOnboardingStore.getState();

    expect(state.step).toBe(1);
  });

  it("sets seat input", () => {
    useOnboardingStore.getState().setSeatInput("A-12-34");
    const state = useOnboardingStore.getState();

    expect(state.seatInput).toBe("A-12-34");
  });

  it("sets selected team ID", () => {
    useOnboardingStore.getState().setSelectedTeamId("team-north-wolves");
    const state = useOnboardingStore.getState();

    expect(state.selectedTeamId).toBe("team-north-wolves");
  });

  it("clears selected team ID", () => {
    useOnboardingStore.getState().setSelectedTeamId("team-north-wolves");
    useOnboardingStore.getState().setSelectedTeamId(null);
    const state = useOnboardingStore.getState();

    expect(state.selectedTeamId).toBeNull();
  });

  it("resets all state", () => {
    useOnboardingStore.getState().goToNextStep();
    useOnboardingStore.getState().setSeatInput("A-12-34");
    useOnboardingStore.getState().setSelectedTeamId("team-north-wolves");
    useOnboardingStore.getState().resetOnboarding();

    const state = useOnboardingStore.getState();

    expect(state.step).toBe(1);
    expect(state.direction).toBe("forward");
    expect(state.seatInput).toBe("");
    expect(state.selectedTeamId).toBeNull();
  });
});
