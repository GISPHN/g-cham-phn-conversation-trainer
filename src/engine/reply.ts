import { ConversationState, Message, Scenario, TurnAnalysis } from "../domain/types";

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

type Intent =
  | "greeting"
  | "concern"
  | "barrier"
  | "change"
  | "importance"
  | "work"
  | "diet"
  | "exercise"
  | "alcohol"
  | "smoking"
  | "sleep"
  | "family"
  | "history"
  | "checkup"
  | "other";

function detectIntent(text: string): Intent {
  const t = compact(text);

  if (hasAny(t, ["こんにちは", "よろしく", "はじめまして", "おはよう", "こんばんは"])) return "greeting";
  if (hasAny(t, ["何が気になる", "どこが気になる", "気になっている", "心配", "不安"])) return "concern";
  if (hasAny(t, ["困って", "難しい", "できない理由", "障害", "妨げ", "大変"])) return "barrier";
  if (hasAny(t, ["変えられそう", "できそう", "取り組めそう", "始められそう", "何ならできる"])) return "change";
  if (hasAny(t, ["大切", "楽しみ", "続けたい", "目標", "どうなりたい", "価値"])) return "importance";
  if (hasAny(t, ["仕事", "勤務", "職業", "働", "忙しい", "残業"])) return "work";
  if (hasAny(t, ["食事", "昼食", "夕食", "朝食", "外食", "食べ", "間食", "お菓子"])) return "diet";
  if (hasAny(t, ["運動", "歩く", "歩行", "身体活動", "体を動か", "運動習慣"])) return "exercise";
  if (hasAny(t, ["お酒", "飲酒", "アルコール", "ビール", "晩酌"])) return "alcohol";
  if (hasAny(t, ["たばこ", "タバコ", "喫煙"])) return "smoking";
  if (hasAny(t, ["睡眠", "寝", "眠"])) return "sleep";
  if (hasAny(t, ["家族", "父", "母", "妻", "夫", "子ども", "同居", "一人暮らし"])) return "family";
  if (hasAny(t, ["去年", "前回", "以前", "これまで", "指導"])) return "history";
  if (hasAny(t, ["健診", "結果", "血圧", "中性脂肪", "腹囲", "体重", "健康"])) return "checkup";
  return "other";
}

export function shouldBypassAI(userText: string): boolean {
  const t = compact(userText);
  const intent = detectIntent(userText);

  if (intent === "greeting") return true;

  const matched = topicGroups.filter((group) => hasAny(t, group)).length;
  if (matched === 1 && t.length <= 45) return true;

  return ["concern", "barrier", "change", "importance"].includes(intent) && t.length <= 55;
}

function politeSentence(text: string): string {
  const trimmed = text.trim().replace(/。+$/g, "");
  if (!trimmed) return "";

  if (/[ですますでしたませんでしょうたいですと思います気になります難しいです]$/.test(trimmed)) {
    return trimmed + "。";
  }

  if (/る$/.test(trimmed)) return trimmed.replace(/る$/, "ることが多いです。");
  if (/ある$/.test(trimmed)) return trimmed.replace(/ある$/, "あります。");
  if (/ない$/.test(trimmed)) return trimmed.replace(/ない$/, "ないです。");
  if (/多い$/.test(trimmed)) return trimmed + "です。";
  if (/少ない$/.test(trimmed)) return trimmed + "です。";

  return trimmed + "です。";
}

function splitFacts(text: string): string[] {
  return text
    .split(/[。\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function recentClientTexts(messages: Message[]): string[] {
  return messages
    .filter((m) => m.role === "client")
    .slice(-3)
    .map((m) => m.text);
}

function chooseNonRepeated(candidates: string[], messages: Message[]): string {
  const recent = recentClientTexts(messages);
  const unique = candidates.filter((c) => !recent.some((r) => r === c || r.includes(c) || c.includes(r)));
  return (unique[0] ?? candidates[0] ?? "そうですね。").trim();
}

function styleReply(
  s: Scenario,
  base: string,
  optionalFacts: string[],
  messages: Message[]
): string {
  const level = s.persona.talkativeness ?? "medium";
  const main = politeSentence(base);

  if (level === "low") return main;

  const extras = optionalFacts
    .map(politeSentence)
    .filter(Boolean)
    .filter((x) => x !== main)
    .filter((x) => !recentClientTexts(messages).some((r) => r.includes(x) || x.includes(r)));

  if (level === "medium") {
    return [main, extras[0]].filter(Boolean).join("");
  }

  return [main, extras[0], extras[1]].filter(Boolean).join("");
}

function topicReply(
  s: Scenario,
  text: string,
  st: ConversationState,
  messages: Message[]
): string | null {
  const p = s.persona;
  const intent = detectIntent(text);

  if (intent === "greeting") return "こんにちは。よろしくお願いします。";

  if (intent === "work" && p.occupation) {
    return styleReply(s, `${p.occupation}の仕事をしています`, [
      p.economicConstraint ? `仕事や生活では、${p.economicConstraint}` : "",
    ], messages);
  }

  if (intent === "diet" && p.diet) {
    const facts = splitFacts(p.diet);
    const base = chooseNonRepeated(facts, messages);
    return styleReply(s, base, facts.filter((x) => x !== base), messages);
  }

  if (intent === "exercise" && p.exercise) {
    return styleReply(s, `運動は${p.exercise}という感じです`, [
      p.values ? `${p.values}は続けたいと思っています` : "",
    ], messages);
  }

  if (intent === "alcohol" && p.alcohol) {
    return styleReply(s, `お酒は${p.alcohol}です`, [], messages);
  }

  if (intent === "smoking" && p.smoking) {
    return styleReply(s, `たばこは${p.smoking}です`, [], messages);
  }

  if (intent === "sleep" && p.sleep) {
    return styleReply(s, `睡眠は${p.sleep}です`, [], messages);
  }

  if (intent === "family") {
    const facts = [p.household, p.familyRelationship];
    if (st.disclosure >= 45 && p.familyHistory) facts.push(p.familyHistory);
    const valid = facts.filter(Boolean);
    if (valid.length) {
      const base = chooseNonRepeated(valid, messages);
      return styleReply(s, base, valid.filter((x) => x !== base), messages);
    }
  }

  if (intent === "importance") {
    if (p.values) {
      return styleReply(s, p.values, [
        "できれば今の生活を大きく崩さずに続けたいと思っています",
      ], messages);
    }
  }

  if (intent === "history") {
    const candidates =
      s.id === "shi-02"
        ? [
            "去年も保健指導を受けました",
            "少し取り組んだ時期はありましたが、続かなかったこともあります",
            "毎年同じ説明になると少し疲れる気持ちもあります",
          ]
        : [
            "以前も健診結果について説明を受けたことはあります",
            "その時は特に症状がなかったので、そのままになっていました",
          ];
    const base = chooseNonRepeated(candidates, messages);
    return styleReply(s, base, candidates.filter((x) => x !== base), messages);
  }

  if (intent === "checkup") {
    const candidates = [
      p.checkupHistory ? `健診は${p.checkupHistory}` : "",
      "今回の健診結果は少し気になっています",
      "今は特に体調が悪いわけではないので、どこまで変えた方がいいのかは迷っています",
    ].filter(Boolean);
    const base = chooseNonRepeated(candidates, messages);
    return styleReply(s, base, candidates.filter((x) => x !== base), messages);
  }

  if (intent === "concern") {
    const candidates = [
      p.diet ? `食事では、${splitFacts(p.diet)[0] ?? p.diet}というところが気になっています` : "",
      p.exercise ? `運動が${p.exercise}というところは少し気になっています` : "",
      p.sleep ? `睡眠が${p.sleep}というところも気になっています` : "",
      p.checkupHistory ? `健診については${p.checkupHistory}という点が気になっています` : "",
    ].filter(Boolean);
    const base = chooseNonRepeated(candidates, messages);
    return styleReply(s, base, candidates.filter((x) => x !== base), messages);
  }

  if (intent === "barrier") {
    const candidates = [
      p.economicConstraint && p.economicConstraint !== "特になし"
        ? `${p.economicConstraint}というところが難しいです`
        : "",
      p.occupation ? `${p.occupation}の仕事があるので、生活の時間を一定にするのは簡単ではないです` : "",
      "一度にいろいろ変えるのは難しいと思っています",
    ].filter(Boolean);
    const base = chooseNonRepeated(candidates, messages);
    return styleReply(s, base, candidates.filter((x) => x !== base), messages);
  }

  if (intent === "change") {
    const candidates = [
      p.exercise ? `運動については、${p.exercise}の中で少し変えられることがあるかもしれません` : "",
      p.diet ? `食事については、全部ではなく一つなら変えられるかもしれません` : "",
      "今の生活を全部変えるのは難しいですが、無理のない範囲なら考えてみたいです",
    ].filter(Boolean);
    const base = chooseNonRepeated(candidates, messages);
    return styleReply(s, base, candidates.filter((x) => x !== base), messages);
  }

  return null;
}

export function generateRuleBasedReply(
  s: Scenario,
  st: ConversationState,
  a: TurnAnalysis,
  turn: number,
  userText = "",
  messages: Message[] = []
): string {
  const topical = topicReply(s, userText, st, messages);
  if (topical) return topical;

  if (a.judgmental) {
    return "そういう言い方をされると、少し話しにくく感じます。";
  }

  if (st.resistance >= 72) {
    if (a.reflection || a.empathy) {
      return styleReply(
        s,
        "そうなんです。自分なりにやったこともあるので、そのあたりも聞いてもらえると話しやすいです",
        [],
        messages
      );
    }
    if (a.directive) {
      return "すぐにできるかと言われると、正直ちょっと難しいです。";
    }
  }

  if (a.elicitedReason && st.disclosure >= 35 && s.persona.values) {
    return styleReply(
      s,
      `${s.persona.values}は大切にしたいと思っています`,
      ["そのためにも健康のことは少し気になっています"],
      messages
    );
  }

  if (a.autonomySupport && st.readiness >= 45) {
    return styleReply(
      s,
      "今の生活を全部変えるのは難しいですが、無理なくできることなら考えてみたいです",
      [
        s.persona.exercise ? `運動では${s.persona.exercise}という状況です` : "",
        s.persona.diet ? "食事も全部ではなく一つなら考えられそうです" : "",
      ],
      messages
    );
  }

  if (a.openQuestion) {
    const candidates = [
      "一度にいろいろ変えるのは難しいと思っています",
      "何か一つなら考えられそうです",
      "まずは今の生活のどこなら変えられるか考えてみたいです",
    ];
    const base = chooseNonRepeated(candidates, messages);
    return styleReply(s, base, candidates.filter((x) => x !== base), messages);
  }

  if (a.informationGiving) {
    return "結果については分かりました。自分の生活の中で何から考えるのがよいかは、少し相談したいです。";
  }

  if (turn === 1) return "はい、よろしくお願いします。";

  const fallback = [
    "そうですね。もう少し具体的に聞いてもらえればお話しできると思います",
    "そのことについては、少し考えてみたいです",
    "今の生活に当てはめて考えると、少し迷うところがあります",
  ];
  return chooseNonRepeated(fallback, messages) + "。";
}

export function buildGroundedReplySeed(
  s: Scenario,
  st: ConversationState,
  a: TurnAnalysis,
  turn: number,
  userText = "",
  messages: Message[] = []
): string {
  return generateRuleBasedReply(s, st, a, turn, userText, messages);
}
