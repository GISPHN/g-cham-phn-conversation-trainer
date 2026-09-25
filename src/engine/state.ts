import {
  ConversationState,
  DecisionStatus,
  Persona,
  TurnAnalysis,
} from "../domain/types";

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function constraintScore(value: string, kind: "time" | "financial"): number {
  const t = value || "";
  if (kind === "time") {
    if (/夜勤|交代|長時間|残業|不規則|忙|育児|介護/.test(t)) return 80;
    if (/仕事|勤務|外食/.test(t)) return 60;
    return 35;
  }
  if (/困窮|低所得|経済.*厳|費用|金銭|生活保護/.test(t)) return 80;
  if (/制約|負担/.test(t)) return 60;
  if (/特になし|なし/.test(t)) return 20;
  return 35;
}

function supportScore(persona: Persona): number {
  const text = [persona.household, persona.familyRelationship, persona.socialParticipation]
    .filter(Boolean)
    .join(" ");
  if (/孤立|独居|関係.*悪|疎遠|支援.*なし/.test(text)) return 25;
  if (/良好|同居|交流|支援|定期的/.test(text)) return 70;
  return 50;
}

export function deriveInitialState(
  base: ConversationState,
  persona: Persona
): ConversationState {
  const timeConstraint = clamp(
    Math.max(base.timeConstraint ?? 0, constraintScore(persona.economicConstraint + " " + persona.occupation, "time"))
  );
  const financialConstraint = clamp(
    Math.max(base.financialConstraint ?? 0, constraintScore(persona.economicConstraint, "financial"))
  );
  const socialSupport = clamp(
    Math.round(((base.socialSupport ?? 50) + supportScore(persona)) / 2)
  );
  const structuralBarrier = clamp(
    Math.round(
      timeConstraint * 0.45 +
      financialConstraint * 0.30 +
      (100 - socialSupport) * 0.25
    )
  );

  return {
    ...base,
    timeConstraint,
    financialConstraint,
    socialSupport,
    structuralBarrier,
  };
}

function nextDecisionStatus(
  state: ConversationState,
  analysis: TurnAnalysis
): DecisionStatus {
  const feasibility =
    state.confidence -
    state.structuralBarrier * 0.45 -
    state.resistance * 0.2 +
    state.socialSupport * 0.15;

  if (
    analysis.goalSetting &&
    state.readiness >= 65 &&
    state.importance >= 60 &&
    feasibility >= 25
  ) {
    return "self_selected_goal";
  }

  if (
    state.readiness >= 58 &&
    state.confidence >= 48 &&
    feasibility >= 10
  ) {
    return "tentative_decision";
  }

  if (state.readiness >= 42 || state.importance >= 55) {
    return "considering";
  }

  if (state.concern >= 35 || state.resistance >= 45) {
    return "ambivalent";
  }

  return "not_considering";
}

export function updateState(
  previous: ConversationState,
  analysis: TurnAnalysis
): ConversationState {
  let {
    trust,
    readiness,
    resistance,
    selfEfficacy,
    disclosure,
    concern,
    importance,
    confidence,
    structuralBarrier,
    socialSupport,
    timeConstraint,
    financialConstraint,
  } = previous;

  if (analysis.openQuestion) {
    trust += 2;
    disclosure += 4;
  }
  if (analysis.reflection) {
    trust += 5;
    resistance -= 4;
    disclosure += 4;
  }
  if (analysis.empathy) {
    trust += 4;
    resistance -= 3;
  }
  if (analysis.autonomySupport) {
    readiness += 4;
    selfEfficacy += 5;
    confidence += 5;
    resistance -= 5;
  }
  if (analysis.elicitedReason) {
    readiness += 5;
    concern += 3;
    importance += 6;
  }
  if (analysis.goalSetting && readiness >= 45) {
    selfEfficacy += 4;
    confidence += structuralBarrier >= 70 ? 1 : 5;
  }
  if (analysis.directive && !analysis.autonomySupport) {
    resistance += 7;
    trust -= 4;
    confidence -= 2;
  }
  if (analysis.judgmental) {
    resistance += 12;
    trust -= 10;
    disclosure -= 8;
    confidence -= 4;
  }
  if (analysis.informationGiving && !analysis.openQuestion && !analysis.reflection) {
    resistance += 2;
  }

  const numeric = {
    trust: clamp(trust),
    readiness: clamp(readiness),
    resistance: clamp(resistance),
    selfEfficacy: clamp(selfEfficacy),
    disclosure: clamp(disclosure),
    concern: clamp(concern),
    importance: clamp(importance),
    confidence: clamp(confidence),
    structuralBarrier: clamp(structuralBarrier),
    socialSupport: clamp(socialSupport),
    timeConstraint: clamp(timeConstraint),
    financialConstraint: clamp(financialConstraint),
  };

  const provisional: ConversationState = {
    ...numeric,
    decisionStatus: previous.decisionStatus,
  };

  return {
    ...provisional,
    decisionStatus: nextDecisionStatus(provisional, analysis),
  };
}
