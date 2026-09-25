import { ConversationState, Scenario, TurnAnalysis } from "../domain/types";

const hasAny = (text: string, words: string[]) =>
  words.some((word) => text.includes(word));

const compact = (text: string) => text.replace(/\s+/g, "");

const topicGroups = [
  ["仕事", "勤務", "職業", "働", "忙しい", "残業"],
  ["食事", "昼食", "夕食", "朝食", "外食", "食べ", "間食", "お菓子"],
  ["運動", "歩く", "歩行", "身体活動", "体を動か", "運動習慣"],
  ["お酒", "飲酒", "アルコール", "ビール", "晩酌"],
  ["たばこ", "タバコ", "喫煙"],
  ["家族", "父", "母", "妻", "夫", "子ども", "同居", "一人暮らし"],
  ["睡眠", "寝", "眠"],
  ["趣味", "大切", "楽しみ", "続けたい", "価値"],
  ["健診", "結果", "血圧", "中性脂肪", "腹囲", "体重", "健康"],
  ["去年", "前回", "以前", "これまで", "指導"],
];

export function shouldBypassAI(userText: string): boolean {
  const t = compact(userText);

  if (hasAny(t, ["こんにちは", "よろしく", "はじめまして", "おはよう", "こんばんは"])) {
    return true;
  }

  const matched = topicGroups.filter((group) => hasAny(t, group)).length;

  // 1つの背景事実を直接尋ねる質問はLLMを介さず即答する。
  if (matched === 1 && t.length <= 45) return true;

  return false;
}

function topicReply(
  s: Scenario,
  text: string,
  st: ConversationState
): string | null {
  const t = compact(text);
  const p = s.persona;

  if (hasAny(t, ["こんにちは", "よろしく", "はじめまして", "おはよう", "こんばんは"])) {
    return "こんにちは。よろしくお願いします。";
  }

  if (hasAny(t, ["仕事", "勤務", "職業", "働", "忙しい", "残業"])) {
    if (p.occupation) {
      return `${p.occupation}の仕事をしています。`;
    }
  }

  if (hasAny(t, ["食事", "昼食", "夕食", "朝食", "外食", "食べ", "間食", "お菓子"])) {
    if (p.diet) return p.diet;
  }

  if (hasAny(t, ["運動", "歩く", "歩行", "身体活動", "体を動か", "運動習慣"])) {
    if (p.exercise) return `運動は、${p.exercise}という感じです。`;
  }

  if (hasAny(t, ["お酒", "飲酒", "アルコール", "ビール", "晩酌"])) {
    if (p.alcohol) return `お酒は${p.alcohol}です。`;
  }

  if (hasAny(t, ["たばこ", "タバコ", "喫煙"])) {
    if (p.smoking) return `たばこは${p.smoking}です。`;
  }

  if (hasAny(t, ["睡眠", "寝", "眠"])) {
    if (p.sleep) return `睡眠は${p.sleep}です。`;
  }

  if (hasAny(t, ["家族", "父", "母", "妻", "夫", "子ども", "同居", "一人暮らし"])) {
    const facts = [p.household, p.familyRelationship].filter(Boolean);
    if (st.disclosure >= 45 && p.familyHistory) facts.push(p.familyHistory);
    if (facts.length) return facts.join("。") + "。";
  }

  if (hasAny(t, ["趣味", "大切", "楽しみ", "続けたい", "価値"])) {
    if (p.values) return p.values;
  }

  if (hasAny(t, ["去年", "前回", "以前", "これまで", "指導"])) {
    if (s.id === "shi-02") {
      return "去年も保健指導を受けました。少し取り組んだ時期はありましたが、続かなかったこともあります。毎年同じ説明になると少し疲れます。";
    }
    return "以前も健診の結果について説明を受けたことはあります。";
  }

  if (hasAny(t, ["健診", "結果", "血圧", "中性脂肪", "腹囲", "体重", "健康"])) {
    if (p.checkupHistory) {
      return `健診は${p.checkupHistory}。今回の結果は少し気になっています。`;
    }
    return "今回の健診結果は少し気になっています。";
  }

  return null;
}

export function generateRuleBasedReply(
  s: Scenario,
  st: ConversationState,
  a: TurnAnalysis,
  turn: number,
  userText = ""
): string {
  const topical = topicReply(s, userText, st);
  if (topical) return topical;

  if (a.judgmental) {
    return "そういう言い方をされると、少し話しにくく感じます。";
  }

  if (st.resistance >= 72) {
    if (a.reflection || a.empathy) {
      return "そうなんです。自分なりにやったこともあるので、そのあたりも聞いてもらえると話しやすいです。";
    }
    if (a.directive) {
      return "すぐにできるかと言われると、正直ちょっと難しいです。";
    }
  }

  if (a.elicitedReason && st.disclosure >= 35) {
    if (s.persona.values) {
      return `${s.persona.values}。そのためにも健康のことは少し気になっています。`;
    }
  }

  if (a.autonomySupport && st.readiness >= 45) {
    const exercise = s.persona.exercise || "運動";
    const diet = s.persona.diet || "食事";
    return `今の生活を全部変えるのは難しいですが、${exercise}や${diet}の中で、無理なくできることなら考えてみたいです。`;
  }

  if (a.openQuestion) {
    if (s.persona.economicConstraint && s.persona.economicConstraint !== "特になし") {
      return `一番気になるのは、${s.persona.economicConstraint}というところです。`;
    }
    return "何か一つなら考えられそうですが、生活を大きく変えるのは難しいと思っています。";
  }

  if (a.informationGiving) {
    return "結果については分かりました。自分の生活の中で何から考えるのがよいかは、少し相談したいです。";
  }

  if (turn === 1) return "はい、よろしくお願いします。";

  return "そうですね。もう少し具体的に聞いてもらえればお話しできると思います。";
}

export function buildGroundedReplySeed(
  s: Scenario,
  st: ConversationState,
  a: TurnAnalysis,
  turn: number,
  userText = ""
): string {
  return generateRuleBasedReply(s, st, a, turn, userText);
}
