import {ConversationState,Scenario,TurnAnalysis} from "../domain/types";
export function generateRuleBasedReply(s:Scenario,st:ConversationState,a:TurnAnalysis,turn:number):string{
if(a.judgmental)return"そういう言い方をされると、正直あまり話したくなくなります。";
if(st.resistance>=72){if(a.reflection||a.empathy)return"まあ、そうなんです。何もしていないわけではないんですけど、毎年同じ話になるのが嫌なんですよね。";if(a.directive)return"それが簡単にできるなら、もうやっています。仕事もありますし。";return s.persona.representativeUtterance}
if(a.elicitedReason&&st.disclosure>=35)return"少し気になるのは家族のことですね。身近で生活習慣病の治療をしている人がいるので、自分もこのままでいいのかなとは思います。";
if(a.autonomySupport&&st.readiness>=45){if(s.id==="shi-01")return"帰ってから運動するのは難しいですけど、営業先の移動なら少し歩く距離を増やせるかもしれません。";if(s.id==="shi-02")return"前に夕食を少し減らした時は体重が落ちたんです。会食がない日ならまたできるかもしれません。";return"一つに絞るなら、夕食後のお菓子を毎日ではなく週3日にするくらいならできそうです。"}
if(a.openQuestion)return"そうですね……。気にはなっています。でも、生活全部を変えるのは無理だと思っています。";
if(a.informationGiving)return"数字がよくないのは分かりました。ただ、具体的に何を変えればいいのかがまだピンときません。";
return turn<=1?s.persona.representativeUtterance:"うーん、それならもう少し具体的に聞いてみたいです。";}