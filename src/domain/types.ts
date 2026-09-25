export type Difficulty="初級"|"標準"|"上級";
export type ConversationState={trust:number;readiness:number;resistance:number;selfEfficacy:number;disclosure:number;concern:number};
export type Persona={id:string;age:number;sex:string;occupation:string;healthLiteracy:"低"|"中"|"高";economicConstraint:string;household:string;familyRelationship:string;smoking:string;alcohol:string;exercise:string;diet:string;sleep:string;values:string;representativeUtterance:string};
export type Scenario={id:string;title:string;difficulty:Difficulty;supportType:"動機付け支援"|"積極的支援";persona:Persona;learningObjectives:string[];publicContext:string[];hiddenContext:string[];initialState:ConversationState};
export type TurnAnalysis={openQuestion:boolean;reflection:boolean;empathy:boolean;autonomySupport:boolean;directive:boolean;informationGiving:boolean;elicitedReason:boolean;goalSetting:boolean;judgmental:boolean};
export type Message={role:"phn"|"client";text:string};
export type Feedback={strengths:string[];improvements:string[];unresolved:string[]};