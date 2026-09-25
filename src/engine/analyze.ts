import {TurnAnalysis} from "../domain/types";
const any=(t:string,w:string[])=>w.some(x=>t.includes(x));
export function analyzeTurn(text:string):TurnAnalysis{
return{
openQuestion:/どう|どのよう|どんな|何が|何を|どれ|教えて|聞かせて/.test(text)&&/[？?]|ですか|ますか/.test(text),
reflection:any(text,["ということですね","なんですね","そう感じ","そう思","大変","難しい"]),
empathy:any(text,["大変","難しい","負担","忙しい","頑張","工夫"]),
autonomySupport:any(text,["どうしたい","選ぶ","できそう","取り組めそう","ご自身","あなたとしては","もしするとしたら","決めて"]),
directive:any(text,["してください","すべき","しなければ","絶対","必ず","やめましょう"]),
informationGiving:any(text,["リスク","健診結果","血圧","中性脂肪","腹囲","体重"]),
elicitedReason:any(text,["理由","きっかけ","気になる","大切","変えたい","メリット","困る"]),
goalSetting:any(text,["目標","いつから","何回","どのくらい","具体的","できそう"]),
judgmental:any(text,["だめ","悪い生活","意志が弱","自己管理が","普通は"])
};}