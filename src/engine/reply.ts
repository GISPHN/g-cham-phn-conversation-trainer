import { ConversationState, Message, Scenario, TurnAnalysis } from "../domain/types";

const hasAny = (text: string, words: string[]) =>
  words.some((word) => text.includes(word));

const compact = (text: string) => text.replace(/\s+/g, "");

const topicGroups = [
  ["仕事", "勤務", "職業", "働", "忙しい", "残業"],
  ["食事", "昼食", "夕食", "朝食", "外食", "食べ", "間食", "お菓子", "野菜", "果物", "肉", "魚", "主食", "米", "ご飯", "パン", "麺", "たんぱく"],
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
  if (
    hasAny(t, ["困って", "難しい", "できない理由", "障害", "妨げ", "大変", "心当たり"]) ||
    /自[信身].{0,10}(ない|理由)/.test(t) ||
    /(続けられない|増やせない|減らせない).{0,10}理由/.test(t)
  ) return "barrier";
  if (hasAny(t, ["変えられそう", "できそう", "できますか", "できるでしょう", "可能", "取り組めそう", "始められそう", "何ならできる", "増やせ", "減らせ", "変えられ"])) return "change";
  if (hasAny(t, ["大切", "楽しみ", "続けたい", "目標", "どうなりたい", "価値"])) return "importance";
  if (hasAny(t, ["仕事", "勤務", "職業", "働", "忙しい", "残業"])) return "work";
  if (hasAny(t, ["食事", "昼食", "夕食", "朝食", "外食", "食べ", "間食", "お菓子", "野菜", "果物", "肉", "魚", "主食", "米", "ご飯", "パン", "麺", "たんぱく"])) return "diet";
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
  let s = text.trim().replace(/。+$/g, "");
  if (!s) return "";

  if (/(です|ます|でした|ました|ません|でしょう|と思います|気になります|難しいです)$/.test(s)) {
    return s + "。";
  }

  const replacements: Array<[RegExp, string]> = [
    [/ことが多い$/, "ことが多いです"],
    [/場合が多い$/, "場合が多いです"],
    [/日が多い$/, "日が多いです"],
    [/が多い$/, "が多いです"],
    [/が少ない$/, "が少ないです"],
    [/ではない$/, "ではないです"],
    [/限らない$/, "限らないです"],
    [/していない$/, "していません"],
    [/食べない$/, "食べません"],
    [/飲まない$/, "飲みません"],
    [/できない$/, "できません"],
    [/分からない$/, "分かりません"],
    [/わからない$/, "分かりません"],
    [/がある$/, "があります"],
    [/である$/, "です"],
    [/になる$/, "になります"],
    [/している$/, "しています"],
    [/食べる$/, "食べます"],
    [/飲む$/, "飲みます"],
    [/行く$/, "行きます"],
    [/歩く$/, "歩きます"],
    [/寝る$/, "寝ます"],
    [/起きる$/, "起きます"],
    [/多い$/, "多いです"],
    [/少ない$/, "少ないです"],
  ];

  for (const [pattern, value] of replacements) {
    if (pattern.test(s)) {
      s = s.replace(pattern, value);
      return s + "。";
    }
  }

  if (/[。！？!?]$/.test(s)) return s;
  return s + "。";
}

export function normalizeClientSpeech(text: string): string {
  return text
    .split(/(?<=[。！？!?])|\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => politeSentence(part))
    .join("");
}

function splitFacts(text: string): string[] {
  return text
    .split(/[。\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

type DietSubtopic =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "vegetables"
  | "fruit"
  | "meat"
  | "fish"
  | "staple"
  | "snack"
  | "eatingOut"
  | "protein"
  | "general";

function detectDietSubtopic(text: string): DietSubtopic {
  const t = compact(text);
  if (hasAny(t, ["朝食", "朝ごはん", "朝ご飯"])) return "breakfast";
  if (hasAny(t, ["昼食", "昼ごはん", "昼ご飯", "ランチ"])) return "lunch";
  if (hasAny(t, ["夕食", "晩ごはん", "夕ご飯", "夕飯"])) return "dinner";
  if (hasAny(t, ["野菜", "サラダ"])) return "vegetables";
  if (hasAny(t, ["果物", "フルーツ"])) return "fruit";
  if (hasAny(t, ["肉", "肉料理"])) return "meat";
  if (hasAny(t, ["魚", "魚料理"])) return "fish";
  if (hasAny(t, ["主食", "米", "ご飯", "パン", "麺"])) return "staple";
  if (hasAny(t, ["間食", "お菓子", "菓子", "おやつ"])) return "snack";
  if (hasAny(t, ["外食", "惣菜", "弁当"])) return "eatingOut";
  if (hasAny(t, ["たんぱく", "タンパク", "蛋白"])) return "protein";
  return "general";
}

function dietKeywords(subtopic: DietSubtopic): string[] {
  const map: Record<DietSubtopic, string[]> = {
    breakfast: ["朝食", "朝ごはん", "朝ご飯"],
    lunch: ["昼食", "昼ごはん", "昼ご飯", "ランチ"],
    dinner: ["夕食", "晩ごはん", "夕ご飯", "夕飯"],
    vegetables: ["野菜", "サラダ"],
    fruit: ["果物", "フルーツ"],
    meat: ["肉", "肉料理"],
    fish: ["魚", "魚料理"],
    staple: ["主食", "米", "ご飯", "パン", "麺"],
    snack: ["間食", "お菓子", "菓子", "おやつ"],
    eatingOut: ["外食", "惣菜", "弁当", "調理済み"],
    protein: ["たんぱく", "タンパク", "蛋白", "卵", "乳製品", "肉", "魚"],
    general: [],
  };
  return map[subtopic];
}

function matchingDietFacts(diet: string, subtopic: DietSubtopic): string[] {
  const facts = splitFacts(diet);
  if (subtopic === "general") return facts;
  const words = dietKeywords(subtopic);
  return facts.filter((fact) => hasAny(compact(fact), words));
}

function asksForSpecificDetail(text: string): boolean {
  const t = compact(text);
  return hasAny(t, [
    "どんな",
    "何を",
    "具体的",
    "種類",
    "どれくらい",
    "何回",
    "何個",
    "何皿",
    "量は",
  ]);
}

function asksForChangeFeasibility(text: string): boolean {
  const t = compact(text);
  return hasAny(t, [
    "できますか",
    "できそう",
    "できるでしょう",
    "できると思いますか",
    "できそうですか",
    "やってみませんか",
    "どうでしょう",
    "可能",
    "増やせ",
    "減らせ",
    "変えられ",
    "取り組め",
    "始められ",
  ]);
}

function personaConsistentUnknownReply(s: Scenario): string {
  if (s.persona.healthLiteracy === "高") {
    return "そこまでは普段あまり細かく記録していないので、今ははっきりとは答えにくいです。";
  }
  if (s.persona.talkativeness === "low") {
    return "そこまではあまり意識していないです。";
  }
  return "そこまではあまり意識していないので、具体的にはちょっと答えにくいです。";
}

function changeFeasibilityReply(
  s: Scenario,
  st: ConversationState,
  topicLabel: string,
  explicitFacts: string[],
  messages: Message[]
): string {
  const feasibility =
    st.confidence +
    st.readiness * 0.35 +
    st.socialSupport * 0.1 -
    st.structuralBarrier * 0.35 -
    st.timeConstraint * 0.2;

  const context = explicitFacts[0] ?? "";

  if (
    st.decisionStatus === "self_selected_goal" ||
    (feasibility >= 45 && st.resistance < 55)
  ) {
    return styleReply(
      s,
      `${topicLabel}について、無理のない範囲なら少し変えてみてもよいと思っています`,
      context ? [context] : [],
      messages
    );
  }

  if (
    st.decisionStatus === "considering" ||
    st.decisionStatus === "tentative_decision" ||
    feasibility >= 20
  ) {
    return styleReply(
      s,
      `${topicLabel}を少し変えることならできるかもしれませんが、毎日のこととして続けられるかはまだ自信がありません`,
      context ? [context] : [],
      messages
    );
  }

  return styleReply(
    s,
    `${topicLabel}を変えた方がよいのは分かりますが、今すぐ続けると決めるのは難しいです`,
    context ? [context] : [],
    messages
  );
}

function dietTopicLabel(subtopic: DietSubtopic): string {
  const labels: Record<DietSubtopic, string> = {
    breakfast: "朝食",
    lunch: "昼食",
    dinner: "夕食",
    vegetables: "野菜",
    fruit: "果物",
    meat: "肉料理",
    fish: "魚料理",
    staple: "主食",
    snack: "間食",
    eatingOut: "外食",
    protein: "たんぱく質のとり方",
    general: "食事",
  };
  return labels[subtopic];
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

function isCheckupConversationOpening(text: string): boolean {
  const t = compact(text);
  return (
    /(特定健診|健診).{0,12}結果.{0,20}(伺|お話|説明|確認|見て|振り返)/.test(t) ||
    /結果.{0,12}(一緒に見|確認させ|説明させ)/.test(t)
  );
}

function checkupOpeningReply(
  s: Scenario,
  st: ConversationState,
  messages: Message[]
): string {
  const p = s.persona;

  if (st.resistance >= 65 && st.concern < 60) {
    return styleReply(
      s,
      "はい。ただ、どうして私が保健指導の対象になっているのか、少し気になっています",
      [],
      messages
    );
  }

  if (st.concern >= 60 || p.healthLiteracy === "高") {
    return styleReply(
      s,
      "はい、お願いします",
      ["今回の結果で、どこを特に気をつけた方がいいのか知りたいです"],
      messages
    );
  }

  if (p.initiative === "high" && st.readiness < 45) {
    return styleReply(
      s,
      "わかりました",
      ["ただ、なぜ今回自分が保健指導の対象になったのかは気になります"],
      messages
    );
  }

  return styleReply(s, "わかりました。お願いします", [], messages);
}

function behaviorTopicLabel(text: string): string {
  const t = compact(text);
  if (/野菜|サラダ/.test(t)) return "野菜";
  if (/朝食|朝ごはん|朝ご飯/.test(t)) return "朝食";
  if (/昼食|昼ごはん|昼ご飯|ランチ/.test(t)) return "昼食";
  if (/夕食|夕ごはん|夕ご飯|夕飯/.test(t)) return "夕食";
  if (/間食|お菓子|おやつ/.test(t)) return "間食";
  if (/歩く|ウォーキング/.test(t)) return "歩くこと";
  if (/運動|身体活動/.test(t)) return "運動";
  if (/飲酒|お酒|アルコール/.test(t)) return "飲酒";
  if (/喫煙|たばこ|タバコ/.test(t)) return "喫煙";
  if (/睡眠|寝る|就寝/.test(t)) return "睡眠";
  return "生活習慣";
}

function proposedChangePhrase(text: string): string {
  const t = compact(text);
  const number = t.match(/(?:週に)?([0-9一二三四五六七八九]+)(日|回|分|時間|杯|本|個)/);
  if (number) {
    if (/増や/.test(t)) return `${number[0]}増やす`;
    if (/減ら/.test(t)) return `${number[0]}減らす`;
    if (/歩/.test(t)) return `${number[0]}歩く`;
    if (/運動/.test(t)) return `${number[0]}運動する`;
  }
  if (/増や/.test(t)) return "少し増やす";
  if (/減ら/.test(t)) return "少し減らす";
  return "";
}

function isBehaviorChangeProposal(text: string): boolean {
  const t = compact(text);
  const hasAction =
    /(増やす|増やせ|減らす|減らせ|控える|やめる|始める|続ける|歩く|運動する|食べる日)/.test(t);
  const asksDecision =
    /(できますか|できると思いますか|できそうですか|どうですか|どうでしょう|やってみませんか|取り組めそう)/.test(t);
  return hasAction && asksDecision;
}

function behaviorChangeProposalReply(
  s: Scenario,
  st: ConversationState,
  text: string,
  messages: Message[]
): string {
  const topic = behaviorTopicLabel(text);
  const change = proposedChangePhrase(text);
  const proposal = change ? `${topic}を${change}` : `${topic}を少し変える`;

  const feasibility =
    st.confidence +
    st.readiness * 0.35 +
    st.socialSupport * 0.1 -
    st.structuralBarrier * 0.35 -
    st.timeConstraint * 0.2 -
    st.resistance * 0.15;

  if (
    st.decisionStatus === "tentative_decision" ||
    st.decisionStatus === "self_selected_goal" ||
    feasibility >= 38
  ) {
    return styleReply(
      s,
      `${proposal}くらいなら、やってみてもいいかなと思います`,
      ["毎日完璧にできるかは分かりませんが、それくらいなら考えられそうです"],
      messages
    );
  }

  if (
    st.decisionStatus === "considering" ||
    feasibility >= 12
  ) {
    return styleReply(
      s,
      `${proposal}ことはできるかもしれませんが、続けられるかはまだ少し自信がありません`,
      [],
      messages
    );
  }

  return styleReply(
    s,
    `${proposal}方がいいのは分かりますが、今の生活で続けるとなると少し難しいです`,
    [],
    messages
  );
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

  // Conversational act takes priority over topical lookup.
  if (isCheckupConversationOpening(text)) {
    return checkupOpeningReply(s, st, messages);
  }

  if (isBehaviorChangeProposal(text)) {
    return behaviorChangeProposalReply(s, st, text, messages);
  }

  if (intent === "work" && p.occupation) {
    return styleReply(s, `${p.occupation}の仕事をしています`, [
      p.economicConstraint ? `仕事や生活では、${p.economicConstraint}` : "",
    ], messages);
  }

  const dietMentioned =
    intent === "diet" ||
    hasAny(compact(text), ["野菜", "果物", "肉", "魚", "主食", "米", "ご飯", "パン", "麺", "たんぱく"]);

  if (dietMentioned && p.diet) {
    const subtopic = detectDietSubtopic(text);
    const matchedFacts = matchingDietFacts(p.diet, subtopic);

    if (asksForChangeFeasibility(text)) {
      return changeFeasibilityReply(
        s,
        st,
        dietTopicLabel(subtopic),
        matchedFacts,
        messages
      );
    }

    if (matchedFacts.length > 0) {
      const base = chooseNonRepeated(matchedFacts, messages);
      return styleReply(
        s,
        base,
        matchedFacts.filter((x) => x !== base),
        messages
      );
    }

    if (subtopic !== "general" || asksForSpecificDetail(text)) {
      return personaConsistentUnknownReply(s);
    }

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
      p.economicConstraint &&
      !/^(特になし|なし|特に制約なし|制約なし|特段なし)$/.test(p.economicConstraint.trim())
        ? `${p.economicConstraint}というところが難しいです`
        : "",
      p.occupation
        ? `${p.occupation}の仕事があるので、忙しい日は食事の時間や内容を一定にするのが難しいです`
        : "",
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
