import { create } from "zustand";

export type OnboardingStep = 1 | 2 | 3;

interface OnboardingState {
  step: OnboardingStep;
  direction: "forward" | "back";
  seatInput: string;
  selectedTeamId: string | null;
  setSeatInput: (seatInput: string) => void;
  setSelectedTeamId: (teamId: string | null) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  resetOnboarding: () => void;
}

const INITIAL_STATE = {
  step: 1 as OnboardingStep,
  direction: "forward" as const,
  seatInput: "",
  selectedTeamId: null,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...INITIAL_STATE,
  setSeatInput: (seatInput) => set({ seatInput }),
  setSelectedTeamId: (selectedTeamId) => set({ selectedTeamId }),
  goToNextStep: () =>
    set((state) => ({
      step: Math.min(3, state.step + 1) as OnboardingStep,
      direction: "forward",
    })),
  goToPreviousStep: () =>
    set((state) => ({
      step: Math.max(1, state.step - 1) as OnboardingStep,
      direction: "back",
    })),
  resetOnboarding: () => set(INITIAL_STATE),
}));
