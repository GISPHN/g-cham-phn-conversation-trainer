import {Feedback,Message,TurnAnalysis} from "../domain/types";
export function buildFeedback(messages:Message[],a:TurnAnalysis[]):Feedback{
const strengths:string[]=[],improvements:string[]=[],unresolved:string[]=[];const n=(k:keyof TurnAnalysis)=>a.filter(x=>Boolean(x[k])).length;
if(n("openQuestion")>=2)strengths.push("開かれた質問を複数回使用し、対象者が背景を語る余地を作っています。");
if(n("reflection")>=1)strengths.push("対象者の発言を受け止める応答が含まれています。");
if(n("autonomySupport")>=1)strengths.push("対象者自身が行動を選択する余地を残した支援ができています。");
if(n("directive")>=2)improvements.push("指示的な表現が複数あります。提案の前に本人の考えや実行可能性を確認してください。");
if(n("reflection")===0)improvements.push("対象者の言葉を要約、反映する応答を追加する余地があります。");
if(n("autonomySupport")===0)improvements.push("本人が選択できる問いかけを追加する余地があります。");
if(n("goalSetting")===0)unresolved.push("実行可能な行動目標の具体化まで到達していません。");
if(messages.filter(m=>m.role==="phn").length<4)unresolved.push("生活背景や行動変容の準備状態を十分に確認できていない可能性があります。");
if(!strengths.length)strengths.push("健診結果や生活習慣について対話を開始できています。");
return{strengths,improvements,unresolved};}