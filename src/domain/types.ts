export type Difficulty = "初級" | "標準" | "上級";
export type SupportType = "動機付け支援" | "積極的支援";
export type InitialDecisionStatus = Exclude<DecisionStatus, "self_selected_goal">;
export type TrainingSelectionMode = "criteria" | "random";

export type TrainingProfile = {
  difficulty: Difficulty;
  supportType: SupportType;
  initialDecisionStatus: InitialDecisionStatus;
};

export type DecisionStatus =
  | "not_considering"
  | "ambivalent"
  | "considering"
  | "tentative_decision"
  | "self_selected_goal";

export type ConversationState = {
  trust: number;
  readiness: number;
  resistance: number;
  selfEfficacy: number;
  disclosure: number;
  concern: number;
  importance: number;
  confidence: number;
  structuralBarrier: number;
  socialSupport: number;
  timeConstraint: number;
  financialConstraint: number;
  decisionStatus: DecisionStatus;
};

export type Persona = {
  id: string;
  age: number;
  sex: string;
  occupation: string;
  healthLiteracy: "低" | "中" | "高";
  economicConstraint: string;
  household: string;
  familyRelationship: string;
  smoking: string;
  alcohol: string;
  exercise: string;
  diet: string;
  sleep: string;
  values: string;
  representativeUtterance: string;
  education?: string;
  prefecture?: string;
  bigFive?: string;
  socialParticipation?: string;
  familyHistory?: string;
  checkupHistory?: string;
  source?: "JMED-Personas" | "demo";
  sourceId?: string;
  talkativeness?: "low" | "medium" | "high";
  initiative?: "low" | "medium" | "high";
};

export type Scenario = {
  id: string;
  title: string;
  difficulty: Difficulty;
  supportType: SupportType;
  persona: Persona;
  learningObjectives: string[];
  publicContext: string[];
  hiddenContext: string[];
  initialState: ConversationState;
};

export type TurnAnalysis = {
  openQuestion: boolean;
  reflection: boolean;
  empathy: boolean;
  autonomySupport: boolean;
  directive: boolean;
  informationGiving: boolean;
  elicitedReason: boolean;
  goalSetting: boolean;
  elicitsGoal: boolean;
  behaviorProposal: boolean;
  checkupOpening: boolean;
  judgmental: boolean;
};

export type Message = {
  role: "phn" | "client";
  text: string;
};

export type Feedback = {
  strengths: string[];
  improvements: string[];
  unresolved: string[];
};
