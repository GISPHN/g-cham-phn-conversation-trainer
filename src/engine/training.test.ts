import { describe, expect, it } from "vitest";
import {
  buildTrainingInitialState,
  createTrainingScenario,
  difficultyOptions,
  initialDecisionOptions,
  randomTrainingProfile,
  supportTypeOptions,
} from "./training";
import type { TrainingProfile } from "../domain/types";

describe("training target configuration", () => {
  it("creates every requested combination without changing the requested labels", () => {
    for (const difficulty of difficultyOptions) {
      for (const supportType of supportTypeOptions) {
        for (const decision of initialDecisionOptions) {
          const profile: TrainingProfile = {
            difficulty,
            supportType,
            initialDecisionStatus: decision.value,
          };
          const scenario = createTrainingScenario(profile);
          expect(scenario.difficulty).toBe(difficulty);
          expect(scenario.supportType).toBe(supportType);
          expect(scenario.initialState.decisionStatus).toBe(decision.value);
        }
      }
    }
  });

  it("does not allow a self-selected goal as an initial training state", () => {
    const allowed = initialDecisionOptions.map((x) => x.value);
    expect(allowed).not.toContain("self_selected_goal");
  });

  it("makes advanced cases more structurally difficult than beginner cases", () => {
    const beginner = buildTrainingInitialState({
      difficulty: "初級",
      supportType: "動機付け支援",
      initialDecisionStatus: "ambivalent",
    });
    const advanced = buildTrainingInitialState({
      difficulty: "上級",
      supportType: "動機付け支援",
      initialDecisionStatus: "ambivalent",
    });

    expect(advanced.structuralBarrier).toBeGreaterThan(beginner.structuralBarrier);
    expect(advanced.resistance).toBeGreaterThan(beginner.resistance);
    expect(advanced.trust).toBeLessThan(beginner.trust);
  });

  it("orders initial readiness by decision state", () => {
    const states = initialDecisionOptions.map((decision) =>
      buildTrainingInitialState({
        difficulty: "標準",
        supportType: "積極的支援",
        initialDecisionStatus: decision.value,
      })
    );

    expect(states[0].readiness).toBeLessThan(states[1].readiness);
    expect(states[1].readiness).toBeLessThan(states[2].readiness);
    expect(states[2].readiness).toBeLessThan(states[3].readiness);
  });

  it("random selection always returns one of the supported options", () => {
    for (let i = 0; i < 30; i += 1) {
      const profile = randomTrainingProfile();
      expect(difficultyOptions).toContain(profile.difficulty);
      expect(supportTypeOptions).toContain(profile.supportType);
      expect(initialDecisionOptions.map((x) => x.value)).toContain(
        profile.initialDecisionStatus
      );
    }
  });
});
