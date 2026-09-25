import {ConversationState,Message,Scenario,TurnAnalysis} from "../domain/types";
export type AIReplyInput={scenario:Scenario;state:ConversationState;analysis:TurnAnalysis;messages:Message[]};
export interface DialogueAI{id:string;name:string;available():Promise<boolean>;reply(input:AIReplyInput):Promise<string>}
/* WebLLMは将来ここへ実装。JMED-Personasは背景、stateは状態遷移エンジンが管理し、対象者AIと教育評価AIは分離する。 */