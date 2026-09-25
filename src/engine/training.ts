import {
  ConversationState,
  Difficulty,
  InitialDecisionStatus,
  Scenario,
  SupportType,
  TrainingProfile,
} from "../domain/types";
import { scenarios } from "../data/scenarios";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const decisionLabels: Record<InitialDecisionStatus, string> = {
  not_considering: "まだ考えていない",
  ambivalent: "迷いがある",
  considering: "検討している",
  tentative_decision: "やってみようかと考えている",
};

const decisionPreset: Record<
  InitialDecisionStatus,
  Pick<
    ConversationState,
    | "readiness"
    | "resistance"
    | "selfEfficacy"
    | "concern"
    | "importance"
    | "confidence"
  >
> = {
  not_considering: {
    readiness: 22,
    resistance: 66,
    selfEfficacy: 34,
    concern: 30,
    importance: 34,
    confidence: 32,
  },
  ambivalent: {
    readiness: 40,
    resistance: 55,
    selfEfficacy: 38,
    concern: 48,
    importance: 55,
    confidence: 38,
  },
  considering: {
    readiness: 55,
    resistance: 36,
    selfEfficacy: 48,
    concern: 60,
    importance: 65,
    confidence: 50,
  },
  tentative_decision: {
    readiness: 66,
    resistance: 26,
    selfEfficacy: 58,
    concern: 66,
    importance: 72,
    confidence: 60,
  },
};

const difficultyPreset: Record<
  Difficulty,
  Pick<
    ConversationState,
    | "trust"
    | "disclosure"
    | "structuralBarrier"
    | "socialSupport"
    | "timeConstraint"
    | "financialConstraint"
  > & { resistanceAdjustment: number; confidenceAdjustment: number }
> = {
  初級: {
    trust: 62,
    disclosure: 56,
    structuralBarrier: 32,
    socialSupport: 64,
    timeConstraint: 34,
    financialConstraint: 24,
    resistanceAdjustment: -10,
    confidenceAdjustment: 7,
  },
  標準: {
    trust: 46,
    disclosure: 38,
    structuralBarrier: 55,
    socialSupport: 52,
    timeConstraint: 55,
    financialConstraint: 34,
    resistanceAdjustment: 0,
    confidenceAdjustment: 0,
  },
  上級: {
    trust: 31,
    disclosure: 25,
    structuralBarrier: 74,
    socialSupport: 38,
    timeConstraint: 72,
    financialConstraint: 46,
    resistanceAdjustment: 12,
    confidenceAdjustment: -8,
  },
};

export const initialDecisionOptions: Array<{
  value: InitialDecisionStatus;
  label: string;
}> = [
  { value: "not_considering", label: "まだ考えていない" },
  { value: "ambivalent", label: "迷いがある" },
  { value: "considering", label: "検討している" },
  { value: "tentative_decision", label: "やってみようかと考えている" },
];

export const difficultyOptions: Difficulty[] = ["初級", "標準", "上級"];
export const supportTypeOptions: SupportType[] = ["動機付け支援", "積極的支援"];

export function buildTrainingInitialState(
  profile: TrainingProfile
): ConversationState {
  const decision = decisionPreset[profile.initialDecisionStatus];
  const difficulty = difficultyPreset[profile.difficulty];

  return {
    trust: difficulty.trust,
    readiness: decision.readiness,
    resistance: clamp(decision.resistance + difficulty.resistanceAdjustment),
    selfEfficacy: decision.selfEfficacy,
    disclosure: difficulty.disclosure,
    concern: decision.concern,
    importance: decision.importance,
    confidence: clamp(decision.confidence + difficulty.confidenceAdjustment),
    structuralBarrier: difficulty.structuralBarrier,
    socialSupport: difficulty.socialSupport,
    timeConstraint: difficulty.timeConstraint,
    financialConstraint: difficulty.financialConstraint,
    decisionStatus: profile.initialDecisionStatus,
  };
}

function pickTemplate(profile: TrainingProfile): Scenario {
  const exact = scenarios.find(
    (scenario) =>
      scenario.difficulty === profile.difficulty &&
      scenario.supportType === profile.supportType
  );
  if (exact) return exact;

  const sameDifficulty = scenarios.find(
    (scenario) => scenario.difficulty === profile.difficulty
  );
  if (sameDifficulty) return sameDifficulty;

  const sameSupport = scenarios.find(
    (scenario) => scenario.supportType === profile.supportType
  );
  return sameSupport ?? scenarios[0];
}

export function createTrainingScenario(profile: TrainingProfile): Scenario {
  const template = pickTemplate(profile);
  const decisionLabel = decisionLabels[profile.initialDecisionStatus];

  return {
    ...template,
    id: `training-${profile.difficulty}-${profile.supportType}-${profile.initialDecisionStatus}`,
    title: `${profile.difficulty}ケース｜${decisionLabel}から始まる面接`,
    difficulty: profile.difficulty,
    supportType: profile.supportType,
    initialState: buildTrainingInitialState(profile),
    learningObjectives: Array.from(
      new Set([
        ...template.learningObjectives,
        "対象者の意思決定状態に合わせて介入の強さと言葉を調整する",
        "生活背景やSDOHを確認し、本人にとって実行可能な選択肢を探索する",
      ])
    ),
  };
}

export function randomTrainingProfile(): TrainingProfile {
  const difficulty =
    difficultyOptions[Math.floor(Math.random() * difficultyOptions.length)];
  const supportType =
    supportTypeOptions[Math.floor(Math.random() * supportTypeOptions.length)];
  const decision =
    initialDecisionOptions[
      Math.floor(Math.random() * initialDecisionOptions.length)
    ].value;

  return {
    difficulty,
    supportType,
    initialDecisionStatus: decision,
  };
}

export function trainingProfileLabel(profile: TrainingProfile): string {
  return `${profile.difficulty}／${profile.supportType}／${decisionLabels[profile.initialDecisionStatus]}`;
}
