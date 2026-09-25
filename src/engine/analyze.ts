import { TurnAnalysis } from "../domain/types";

const any = (t: string, w: string[]) => w.some((x) => t.includes(x));

export function analyzeTurn(text: string): TurnAnalysis {
  const compact = text.replace(/\s+/g, "");

  const checkupOpening =
    /(特定健診|健診).{0,12}結果.{0,20}(伺|お話|説明|確認|見て|振り返)/.test(compact) ||
    /結果.{0,12}(一緒に見|確認させ|説明させ)/.test(compact);

  const behaviorProposal =
    /(増やす|減らす|控える|やめる|始める|続ける|歩く|運動する|食べる).{0,18}(できますか|できると思いますか|できそうですか|どうですか|どうでしょう|やってみませんか)/.test(compact) ||
    /(週に|1日|一日|毎日|何分|何回).{0,12}(増やす|減らす|歩く|運動|食べる|控える)/.test(compact);

  const elicitsGoal =
    /(何なら|何から|どんな(?:こと|内容|方法)なら|どのような(?:こと|内容|方法)なら|ご自身では|自分では).{0,24}(できそう|始められそう|取り組めそう|変えられそう)/.test(compact) ||
    /(目標).{0,12}(何に|どう|決め|考え)/.test(compact) ||
    /(自分で|ご自身で).{0,12}(決め|選)/.test(compact);

  return {
    openQuestion:
      /どう|どのよう|どんな|何が|何を|どれ|教えて|聞かせて/.test(text) &&
      /[？?]|ですか|ますか/.test(text),
    reflection: any(text, [
      "ということですね",
      "なんですね",
      "そう感じ",
      "そう思",
      "大変",
      "難しい",
    ]),
    empathy: any(text, ["大変", "難しい", "負担", "忙しい", "頑張", "工夫"]),
    autonomySupport:
      any(text, [
        "どうしたい",
        "選ぶ",
        "できそう",
        "取り組めそう",
        "ご自身",
        "あなたとしては",
        "もしするとしたら",
        "決めて",
        "無理なく",
      ]) ||
      /できますか|できると思いますか|できそうですか|どうでしょう/.test(compact),
    directive: any(text, [
      "してください",
      "すべき",
      "しなければ",
      "絶対",
      "必ず",
      "やめましょう",
    ]),
    informationGiving:
      any(text, ["リスク", "健診結果", "血圧", "中性脂肪", "腹囲", "体重"]) &&
      !checkupOpening,
    elicitedReason: any(text, [
      "理由",
      "きっかけ",
      "気になる",
      "大切",
      "変えたい",
      "メリット",
      "困る",
    ]),
    goalSetting:
      behaviorProposal ||
      elicitsGoal ||
      any(text, ["目標", "いつから", "何回", "何日", "どのくらい", "具体的"]),
    elicitsGoal,
    behaviorProposal,
    checkupOpening,
    judgmental: any(text, ["だめ", "悪い生活", "意志が弱", "自己管理が", "普通は"]),
  };
}
