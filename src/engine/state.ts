import {ConversationState,TurnAnalysis} from "../domain/types";
const c=(v:number)=>Math.max(0,Math.min(100,Math.round(v)));
export function updateState(p:ConversationState,a:TurnAnalysis):ConversationState{
let{trust,readiness,resistance,selfEfficacy,disclosure,concern}=p;
if(a.openQuestion){trust+=2;disclosure+=4} if(a.reflection){trust+=5;resistance-=4;disclosure+=4}
if(a.empathy){trust+=4;resistance-=3} if(a.autonomySupport){readiness+=4;selfEfficacy+=5;resistance-=5}
if(a.elicitedReason){readiness+=5;concern+=3} if(a.goalSetting&&readiness>=45)selfEfficacy+=4;
if(a.directive&&!a.autonomySupport){resistance+=7;trust-=4} if(a.judgmental){resistance+=12;trust-=10;disclosure-=8}
if(a.informationGiving&&!a.openQuestion&&!a.reflection)resistance+=2;
return{trust:c(trust),readiness:c(readiness),resistance:c(resistance),selfEfficacy:c(selfEfficacy),disclosure:c(disclosure),concern:c(concern)};}