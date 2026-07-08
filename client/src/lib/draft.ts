import type { BudgetTier, Companions, TripVibe } from './types';

/** The onboarding flow's in-progress answers, persisted so a session can be resumed. */
export interface OnboardingAnswers {
  destinationKnown: boolean | null;
  destination: string;
  vibe: TripVibe[];
  duration: number;
  budgetTier: BudgetTier | null;
  companions: Companions | null;
  foodPreferences: string[];
  customInterests: string[];
}

export interface PlanDraft {
  step: number;
  answers: OnboardingAnswers;
  savedAt: string;
}

const KEY = 'roam.plan.draft.v1';

export const EMPTY_ANSWERS: OnboardingAnswers = {
  destinationKnown: null,
  destination: '',
  vibe: [],
  duration: 5,
  budgetTier: null,
  companions: null,
  foodPreferences: [],
  customInterests: [],
};

export function loadPlanDraft(): PlanDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlanDraft;
    if (!parsed || typeof parsed.step !== 'number' || !parsed.answers) return null;
    return { ...parsed, answers: { ...EMPTY_ANSWERS, ...parsed.answers } };
  } catch {
    return null;
  }
}

export function savePlanDraft(step: number, answers: OnboardingAnswers): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ step, answers, savedAt: new Date().toISOString() } satisfies PlanDraft),
    );
  } catch {
    /* storage full or blocked — resume is best-effort */
  }
}

export function clearPlanDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
