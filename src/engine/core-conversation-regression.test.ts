import { describe, expect, it } from "vitest";
import { scenarios } from "../data/scenarios";
import type { Scenario } from "../domain/types";
import {
  detectPersonaDetailRequest,
  generatePersonaConsistentFallbackDetail,
  isPersonaDetailAnswerValid,
  personaEvidenceForDetail,
  type PersonaDetailRequest,
  type PersonaSessionMemory,
} from "./personaMemory";
import { analyzeTurn } from "./analyze";
import { updateState, updateStateFromClientReaction } from "./state";

function richScenario(): Scenario {
  const base = scenarios[0];
  return {
    ...base,
    persona: {
      ...base.persona,
      id: "regression-rich-persona",
      occupation: "営業職で外回りが多く、残業もある",
      economicConstraint: "健康づくりに大きな費用はかけにくい",
      household: "配偶者と子ども1人と同居",
      familyRelationship: "家族関係は良好で、配偶者には健康の相談ができる",
      smoking: "紙巻きたばこを喫煙している",
      alcohol: "ビールを週5日程度、夕食時に飲む",
      exercise: "通勤時に歩く程度で、定期的な運動習慣はない",
      diet:
        "朝食はパンが多い。昼食は外食が多い。夕食は自宅で食べることが多く、野菜は毎日ではない。",
      sleep: "平日は5〜6時間程度で、帰宅が遅い日は就寝も遅くなる",
      values: "家族との夕食と仕事上の責任を大切にしている",
      representativeUtterance:
        "健康は気になりますが、仕事があると毎日同じようにはできないです。",
      checkupHistory: "毎年受診している",
      primaryDiagnosis: "脂質異常症",
      pastMedicalHistory: "脂質異常症を指摘されたことがある",
      symptoms: "自覚症状は特にない",
      familyHistory: "父が糖尿病で治療中",
      weight: "78 kg",
      bmi: "26.1",
      vitalSigns: "血圧 142/88 mmHg",
      bloodTests: "HbA1c 6.1%、LDLコレステロール 155 mg/dL、中性脂肪 180 mg/dL",
      medications: "処方薬あり",
      medicationAdherence: "飲み忘れはほとんどない",
      healthcareUse: "3か月ごとに受診",
      healthcareAccess: "自家用車で20分程度",
      socialParticipation: "地域活動への参加は少ないが、職場の同僚との交流はある",
      personaLifestyleBackground:
        "外回りと残業があり、平日は生活時間が不規則になりやすい",
      personaPsychology:
        "健康の必要性は理解しているが、仕事を優先すると行動を継続できる自信が下がる",
      personaLifestyle:
        "昼食は外食が多く、運動は通勤時の歩行が中心",
      personaSupportPoints:
        "一度に複数の変更を求めず、本人が選べる小さな行動を検討する",
      talkativeness: "medium",
      initiative: "medium",
    },
  };
}

type DetectionCase = {
  q: string;
  domain: string;
  dimension: string;
  subject?: string;
};

const detectionCases: DetectionCase[] = [
  { q: "朝食は具体的に何を食べていますか", domain: "diet", dimension: "items" },
  { q: "昼食の外食は週に何日くらいですか", domain: "diet", dimension: "frequency" },
  { q: "夕食の野菜はどれくらいの量ですか", domain: "diet", dimension: "amount" },
  { q: "間食は食べていますか", domain: "diet", dimension: "presence" },
  { q: "甘いものは週に何回くらい食べますか", domain: "diet", dimension: "frequency" },
  { q: "ウォーキングは1回何分くらいですか", domain: "exercise", dimension: "duration", subject: "walking" },
  { q: "筋トレは週に何回していますか", domain: "exercise", dimension: "frequency", subject: "strength" },
  { q: "普段どのくらい座っている時間がありますか", domain: "exercise", dimension: "duration", subject: "sedentary" },
  { q: "運動を続けにくい理由は何ですか", domain: "exercise", dimension: "barrier" },
  { q: "紙巻きたばこは1日何本くらいですか", domain: "smoking", dimension: "amount", subject: "cigarette" },
  { q: "加熱式たばこも吸いますか", domain: "smoking", dimension: "presence", subject: "heated_tobacco" },
  { q: "これまで禁煙したことはありますか", domain: "smoking", dimension: "history", subject: "quit_attempt" },
  { q: "たばこを吸いたくなるのはどんな時ですか", domain: "smoking", dimension: "time", subject: "craving" },
  { q: "ビールは1回に何本くらい飲みますか", domain: "alcohol", dimension: "amount", subject: "beer" },
  { q: "ワインは週に何回くらい飲みますか", domain: "alcohol", dimension: "frequency", subject: "wine" },
  { q: "飲み会では誰と飲むことが多いですか", domain: "alcohol", dimension: "context", subject: "social_drinking" },
  { q: "普段は何時ごろ寝ていますか", domain: "sleep", dimension: "time", subject: "bedtime" },
  { q: "何時ごろ起きていますか", domain: "sleep", dimension: "time", subject: "wakeup" },
  { q: "寝つきはどうですか", domain: "sleep", dimension: "detail", subject: "onset" },
  { q: "日中の眠気は週に何日くらいありますか", domain: "sleep", dimension: "frequency", subject: "daytime_sleepiness" },
  { q: "残業は週に何回くらいありますか", domain: "work", dimension: "frequency", subject: "overtime" },
  { q: "夜勤や交代勤務はありますか", domain: "work", dimension: "presence", subject: "shift" },
  { q: "通勤には何分くらいかかりますか", domain: "work", dimension: "duration", subject: "commute" },
  { q: "仕事は何時ごろ終わりますか", domain: "work", dimension: "time", subject: "schedule" },
  { q: "血圧はどのくらいでしたか", domain: "checkup", dimension: "amount", subject: "blood_pressure" },
  { q: "HbA1cはどのくらいでしたか", domain: "checkup", dimension: "amount", subject: "hba1c" },
  { q: "LDLコレステロールはどのくらいでしたか", domain: "checkup", dimension: "amount", subject: "lipids" },
  { q: "体重はどのくらいでしたか", domain: "checkup", dimension: "amount", subject: "weight" },
  { q: "BMIはどのくらいでしたか", domain: "checkup", dimension: "amount", subject: "bmi" },
  { q: "これまで病気を指摘されたことはありますか", domain: "medical", dimension: "history", subject: "diagnosis" },
  { q: "今、何か症状はありますか", domain: "medical", dimension: "presence", subject: "symptom" },
  { q: "家族に同じような病気の人はいますか", domain: "medical", dimension: "presence", subject: "family_history" },
  { q: "薬の飲み忘れは週に何回くらいありますか", domain: "medication", dimension: "frequency", subject: "adherence" },
  { q: "薬はいつ飲んでいますか", domain: "medication", dimension: "time", subject: "timing" },
  { q: "薬について不安や心配はありますか", domain: "medication", dimension: "presence", subject: "concern" },
  { q: "誰と暮らしていますか", domain: "family", dimension: "context", subject: "household" },
  { q: "健康のことは誰に相談できますか", domain: "family", dimension: "support", subject: "keyperson" },
  { q: "地域活動には週に何回くらい参加しますか", domain: "social", dimension: "frequency", subject: "participation" },
  { q: "人との交流が少ないと感じることはありますか", domain: "social", dimension: "presence", subject: "isolation" },
  { q: "食費の面で健康的な食事が難しいことはありますか", domain: "finance", dimension: "barrier", subject: "food_cost" },
  { q: "医療費が負担になって受診しにくいことはありますか", domain: "finance", dimension: "barrier", subject: "healthcare_cost" },
  { q: "病院にはどのような交通手段で通っていますか", domain: "healthcare", dimension: "items", subject: "transport" },
  { q: "病院が遠くて受診しにくいことはありますか", domain: "healthcare", dimension: "barrier", subject: "access" },
  { q: "かかりつけ医はありますか", domain: "healthcare", dimension: "presence", subject: "usual_care" },
  { q: "趣味や楽しみにしていることは何ですか", domain: "values", dimension: "items", subject: "hobby" },
  { q: "生活で一番大切にしていることは何ですか", domain: "values", dimension: "items", subject: "priority" },
  { q: "仕事のストレスはなぜ強くなりますか", domain: "stress", dimension: "reason", subject: "work" },
  { q: "ストレスを解消するためにどんな工夫をしていますか", domain: "stress", dimension: "strategy", subject: "coping" },
  { q: "生活を変えることはどのくらい重要だと思いますか", domain: "motivation", dimension: "importance", subject: "importance" },
  { q: "生活を変える自信はどのくらいありますか", domain: "motivation", dimension: "confidence", subject: "confidence" },
  { q: "今どのくらい取り組む準備ができていますか", domain: "motivation", dimension: "readiness", subject: "readiness" },
  { q: "生活を変えるうえで難しい点は何ですか", domain: "motivation", dimension: "barrier", subject: "barrier" },
  { q: "これからどのような目標にしたいですか", domain: "motivation", dimension: "goal", subject: "goal" },
  { q: "変えたらどんな良いことがありそうですか", domain: "motivation", dimension: "benefit", subject: "benefit" },
  { q: "逆に変えることで困ることはありますか", domain: "motivation", dimension: "disadvantage", subject: "disadvantage" },
  { q: "続けるにはどんな工夫ができそうですか", domain: "motivation", dimension: "strategy" },
];

describe("core conversation regression: intent and detail recognition", () => {
  it.each(detectionCases)("$q", ({ q, domain, dimension, subject }) => {
    const req = detectPersonaDetailRequest(q);
    expect(req, q).not.toBeNull();
    expect(req?.domain, q).toBe(domain);
    expect(req?.dimension, q).toBe(dimension);
    if (subject) expect(req?.subject, q).toBe(subject);
  });
});

describe("core conversation regression: context retention and switching", () => {
  const sequences = [
    {
      name: "exercise walking detail chain",
      turns: [
        ["ウォーキングは普段どのようにしていますか", "exercise.walking.items"],
        ["それは1回何分くらいですか", "exercise.walking.duration"],
        ["週に何回くらいですか", "exercise.walking.frequency"],
        ["続けにくいのはどういう時ですか", "exercise.walking.barrier"],
      ],
    },
    {
      name: "dinner vegetable detail chain",
      turns: [
        ["夕食では野菜を食べていますか", "diet.dinner.vegetables.presence"],
        ["その野菜はどれくらいの量ですか", "diet.dinner.vegetables.amount"],
        ["どんな野菜を食べますか", "diet.dinner.vegetables.items"],
        ["週に何日くらいですか", "diet.dinner.vegetables.frequency"],
      ],
    },
    {
      name: "sleep detail chain",
      turns: [
        ["普段は何時ごろ寝ていますか", "sleep.bedtime.time"],
        ["寝つきはどうですか", "sleep.onset.detail"],
        ["途中で起きることはありますか", "sleep.quality.presence"],
      ],
    },
    {
      name: "work overtime detail chain",
      turns: [
        ["残業は週に何回くらいありますか", "work.overtime.frequency"],
        ["その日は何時ごろ仕事が終わりますか", "work.overtime.time"],
        ["それが生活改善の妨げになりますか", "work.overtime.barrier"],
      ],
    },
  ];

  it.each(sequences)("$name", ({ turns }) => {
    let previous: PersonaDetailRequest | null = null;
    for (const [q, expectedKey] of turns) {
      const req = detectPersonaDetailRequest(q, previous);
      expect(req, q).not.toBeNull();
      expect(req?.key, q).toBe(expectedKey);
      previous = req;
    }
  });

  it("switches cleanly from diet to alcohol to sleep", () => {
    const diet = detectPersonaDetailRequest("夕食の野菜はどれくらいの量ですか");
    const alcohol = detectPersonaDetailRequest(
      "では、お酒は週に何回くらい飲みますか",
      diet
    );
    const sleep = detectPersonaDetailRequest(
      "睡眠時間は何時間くらいですか",
      alcohol
    );
    expect(diet?.domain).toBe("diet");
    expect(alcohol?.domain).toBe("alcohol");
    expect(sleep?.domain).toBe("sleep");
    expect(sleep?.key).toBe("sleep.pattern.duration");
  });

  it("honors a correction instead of carrying the previous food context", () => {
    const previous = detectPersonaDetailRequest(
      "昼食の外食は週に何回くらいですか"
    );
    const corrected = detectPersonaDetailRequest(
      "昼食ではなく、聞きたいのは夕食で野菜を食べているかです",
      previous
    );
    expect(corrected?.key).toBe("diet.dinner.vegetables.presence");
    expect(corrected?.isCorrection).toBe(true);
  });
});

describe("core conversation regression: persona-grounded replies", () => {
  const s = richScenario();

  const replyCases = [
    "朝食は具体的に何を食べていますか",
    "昼食の外食は週に何日くらいですか",
    "夕食の野菜はどれくらいの量ですか",
    "ウォーキングは1回何分くらいですか",
    "運動を続けにくい理由は何ですか",
    "紙巻きたばこは1日何本くらいですか",
    "お酒はどこで飲むことが多いですか",
    "睡眠時間は何時間くらいですか",
    "仕事は何時ごろ終わりますか",
    "家族に協力してもらえそうですか",
    "健康づくりで費用面で難しいことはありますか",
    "病院にはどうやって通っていますか",
    "生活で大切にしていることは何ですか",
    "ストレスを解消するためにどんな工夫をしていますか",
    "生活を変えることはどのくらい重要だと思いますか",
    "生活を変える自信はどのくらいありますか",
    "今どのくらい取り組む準備ができていますか",
    "逆に変えることで困ることはありますか",
    "続けるにはどんな工夫ができそうですか",
  ];

  it.each(replyCases)("%s -> answers the requested dimension", (q) => {
    const req = detectPersonaDetailRequest(q);
    expect(req, q).not.toBeNull();
    const answer = generatePersonaConsistentFallbackDetail(
      s,
      req!,
      {},
      s.initialState
    );
    expect(answer.trim().length, q).toBeGreaterThan(2);
    expect(isPersonaDetailAnswerValid(req!, answer), `${q} -> ${answer}`).toBe(true);
  });

  it("keeps generated lifestyle details stable when asked again later", () => {
    const req = detectPersonaDetailRequest(
      "ウォーキングは1回何分くらいですか"
    )!;
    const first = generatePersonaConsistentFallbackDetail(
      s,
      req,
      {},
      s.initialState
    );
    const memory: PersonaSessionMemory = { [req.key]: first };

    const unrelated = detectPersonaDetailRequest(
      "お酒は週に何回くらい飲みますか"
    )!;
    const alcoholAnswer = generatePersonaConsistentFallbackDetail(
      s,
      unrelated,
      memory,
      s.initialState
    );
    memory[unrelated.key] = alcoholAnswer;

    const repeated = generatePersonaConsistentFallbackDetail(
      s,
      req,
      memory,
      s.initialState
    );
    expect(repeated).toBe(first);
  });

  it("does not return the exact same generic answer for different exercise dimensions", () => {
    const items = detectPersonaDetailRequest(
      "ウォーキングは普段どのようにしていますか"
    )!;
    const duration = detectPersonaDetailRequest(
      "それは1回何分くらいですか",
      items
    )!;
    const first = generatePersonaConsistentFallbackDetail(
      s,
      items,
      {},
      s.initialState
    );
    const second = generatePersonaConsistentFallbackDetail(
      s,
      duration,
      { [items.key]: first },
      s.initialState
    );
    expect(second).not.toBe(first);
    expect(isPersonaDetailAnswerValid(duration, second)).toBe(true);
  });
});

describe("core conversation regression: fact-locked medical information", () => {
  it("uses only the blood-pressure evidence for a blood-pressure question", () => {
    const s = richScenario();
    const req = detectPersonaDetailRequest("血圧はどのくらいでしたか")!;
    const evidence = personaEvidenceForDetail(s, req);
    expect(evidence).toContain("142/88");
    expect(evidence).not.toContain("HbA1c");
    expect(evidence).not.toContain("26.1");
  });

  it("uses blood-test evidence for HbA1c but never invents a new number", () => {
    const s = richScenario();
    const req = detectPersonaDetailRequest("HbA1cはどのくらいでしたか")!;
    const evidence = personaEvidenceForDetail(s, req);
    expect(evidence).toContain("6.1");
    const answer = generatePersonaConsistentFallbackDetail(
      s,
      req,
      {},
      s.initialState
    );
    const numbers = answer.match(/[0-9]+(?:\.[0-9]+)?/g) ?? [];
    for (const n of numbers) {
      expect(`${evidence} ${req.queryText ?? ""}`).toContain(n);
    }
  });

  it("does not invent medication names, doses, or frequencies when absent", () => {
    const s = richScenario();
    s.persona.medications = "";
    s.persona.medicationAdherence = "";
    const req = detectPersonaDetailRequest("薬は何を何回飲んでいますか")!;
    const answer = generatePersonaConsistentFallbackDetail(
      s,
      req,
      {},
      s.initialState
    );
    expect(answer).toMatch(/分から|わから|意識していない|答えにく/);
    expect(answer).not.toMatch(/mg|錠|カプセル|1日[0-9１-９]|朝夕|毎食/);
  });

  it("does not answer an unrecorded waist value with BMI or body weight", () => {
    const s = richScenario();
    s.persona.checkupHistory = "毎年受診している";
    s.persona.personaMedicalBackground = "";
    const req = detectPersonaDetailRequest("腹囲はどのくらいでしたか")!;
    const answer = generatePersonaConsistentFallbackDetail(
      s,
      req,
      {},
      s.initialState
    );
    expect(answer).not.toContain("26.1");
    expect(answer).not.toContain("78");
  });

  it("grounds family-history questions only in recorded family history", () => {
    const s = richScenario();
    const req = detectPersonaDetailRequest(
      "家族に同じような病気の人はいますか"
    )!;
    const evidence = personaEvidenceForDetail(s, req);
    expect(evidence).toContain("父が糖尿病");
    expect(evidence).not.toContain("脂質異常症を指摘");
  });
});

describe("core conversation regression: multi-turn health guidance flows", () => {
  function runDetailFlow(
    s: Scenario,
    questions: string[]
  ): { memory: PersonaSessionMemory; answers: string[] } {
    let previous: PersonaDetailRequest | null = null;
    const memory: PersonaSessionMemory = {};
    const answers: string[] = [];

    for (const q of questions) {
      const req = detectPersonaDetailRequest(q, previous);
      expect(req, q).not.toBeNull();
      const answer = generatePersonaConsistentFallbackDetail(
        s,
        req!,
        memory,
        s.initialState
      );
      expect(answer.trim().length, q).toBeGreaterThan(2);
      expect(isPersonaDetailAnswerValid(req!, answer), `${q} -> ${answer}`).toBe(true);
      memory[req!.key] = answer;
      answers.push(answer);
      previous = req;
    }

    return { memory, answers };
  }

  it("completes a diet exploration chain without losing meal context", () => {
    const s = richScenario();
    const { memory, answers } = runDetailFlow(s, [
      "夕食では野菜を食べていますか",
      "その野菜はどれくらいの量ですか",
      "どんな野菜を食べますか",
      "週に何日くらいですか",
      "続けにくい理由はありますか",
    ]);
    expect(Object.keys(memory).some((k) => k.startsWith("diet.dinner.vegetables"))).toBe(true);
    expect(new Set(answers).size).toBeGreaterThanOrEqual(4);
  });

  it("completes an exercise exploration chain from activity to barrier and strategy", () => {
    const s = richScenario();
    const { answers } = runDetailFlow(s, [
      "ウォーキングは普段どのようにしていますか",
      "それは1回何分くらいですか",
      "週に何回くらいですか",
      "続けにくい理由は何ですか",
      "続けるにはどんな工夫ができそうですか",
    ]);
    expect(answers.some((x) => /仕事|時間|続/.test(x))).toBe(true);
  });

  it("completes a smoking exploration chain without switching to alcohol", () => {
    const s = richScenario();
    const { memory } = runDetailFlow(s, [
      "紙巻きたばこは吸っていますか",
      "1日何本くらいですか",
      "吸いたくなるのはどんな時ですか",
      "これまで禁煙したことはありますか",
    ]);
    expect(Object.keys(memory).every((k) => k.startsWith("smoking."))).toBe(true);
  });

  it("completes a sleep-work-stress chain with explicit topic switches", () => {
    const s = richScenario();
    const { memory } = runDetailFlow(s, [
      "普段は何時ごろ寝ていますか",
      "睡眠時間は何時間くらいですか",
      "残業は週に何回くらいありますか",
      "仕事のストレスはなぜ強くなりますか",
      "ストレスを解消するためにどんな工夫をしていますか",
    ]);
    expect(Object.keys(memory).some((k) => k.startsWith("sleep."))).toBe(true);
    expect(Object.keys(memory).some((k) => k.startsWith("work."))).toBe(true);
    expect(Object.keys(memory).some((k) => k.startsWith("stress."))).toBe(true);
  });

  it("completes a motivational interviewing chain through decision balance", () => {
    const s = richScenario();
    const { memory } = runDetailFlow(s, [
      "生活を変えることはどのくらい重要だと思いますか",
      "生活を変える自信はどのくらいありますか",
      "今どのくらい取り組む準備ができていますか",
      "変えたらどんな良いことがありそうですか",
      "逆に変えることで困ることはありますか",
      "続けるにはどんな工夫ができそうですか",
      "これからどのような目標にしたいですか",
    ]);
    expect(Object.keys(memory).filter((k) => k.startsWith("motivation.")).length).toBeGreaterThanOrEqual(6);
  });
});

describe("core conversation regression: state progression", () => {
  it("raises resistance after judgmental direction", () => {
    const s = richScenario();
    const a = analyzeTurn("そんな生活はだめです。必ず運動してください。");
    const next = updateState(s.initialState, a);
    expect(next.resistance).toBeGreaterThan(s.initialState.resistance);
    expect(next.trust).toBeLessThan(s.initialState.trust);
  });

  it("improves trust and reduces resistance with reflection and empathy", () => {
    const s = richScenario();
    const a = analyzeTurn(
      "仕事が忙しくて続けるのが難しいと感じているんですね。大変でしたね。"
    );
    const next = updateState(s.initialState, a);
    expect(next.trust).toBeGreaterThan(s.initialState.trust);
    expect(next.resistance).toBeLessThan(s.initialState.resistance);
  });

  it("does not mark a PHN proposal itself as a self-selected goal", () => {
    const s = richScenario();
    const text = "週に1回だけ10分歩くことはできそうですか";
    const a = analyzeTurn(text);
    const afterPhn = updateState(s.initialState, a);
    expect(afterPhn.decisionStatus).not.toBe("self_selected_goal");
  });

  it("records tentative acceptance of a PHN proposal as considering or tentative", () => {
    const s = richScenario();
    const text = "週に1回だけ10分歩くことはできそうですか";
    const a = analyzeTurn(text);
    const afterPhn = updateState(s.initialState, a);
    const afterClient = updateStateFromClientReaction(
      afterPhn,
      a,
      "そのくらいなら、できるかもしれません。"
    );
    expect(["considering", "tentative_decision"]).toContain(afterClient.decisionStatus);
  });

  it("records a client-selected goal only after elicitation and explicit acceptance", () => {
    const s = richScenario();
    const text = "ご自身では、どんなことなら取り組めそうですか";
    const a = analyzeTurn(text);
    expect(a.elicitsGoal).toBe(true);
    const afterPhn = updateState(s.initialState, a);
    const afterClient = updateStateFromClientReaction(
      afterPhn,
      a,
      "昼休みに10分歩くことをやってみたいです。"
    );
    expect(afterClient.decisionStatus).toBe("self_selected_goal");
  });
});
