import { describe, expect, it } from "vitest";
import { scenarios } from "../data/scenarios";
import { analyzeTurn } from "./analyze";
import {
  generateRuleBasedReply,
  normalizeClientSpeech,
} from "./reply";
import {
  checkProposalConsistency,
  detectPersonaDetailRequest,
  generatePersonaConsistentFallbackDetail,
  isPersonaDetailAnswerValid,
  personaEvidenceForDetail,
  type PersonaSessionMemory,
} from "./personaMemory";
import {
  updateState,
  updateStateFromClientReaction,
} from "./state";
import type { Scenario } from "../domain/types";

function barberScenario(): Scenario {
  const base = scenarios[0];
  return {
    ...base,
    persona: {
      ...base.persona,
      occupation: "理美容師",
      economicConstraint: "特に制約なし",
      diet:
        "朝食は家庭で食べることが多い。昼食は外食になる日がある。夕食は家庭で食べることが多い。",
      talkativeness: "medium",
      initiative: "medium",
    },
  };
}

describe("dialogue regression", () => {
  it("treats a checkup-result introduction as an opening, not checkup-history lookup", () => {
    const s = barberScenario();
    const text = "今日は健診結果についてお話させていただきます。";
    const a = analyzeTurn(text);
    expect(a.checkupOpening).toBe(true);

    const reply = generateRuleBasedReply(
      s,
      s.initialState,
      a,
      2,
      text,
      []
    );
    expect(reply).toMatch(/わかりました|お願いします|対象/);
    expect(reply).not.toMatch(/過去2年|健診は/);
  });

  it("answers a substantive diet question even when it is preceded by a checkup introduction", () => {
    const s = barberScenario();
    const text =
      "今日は特定健診の結果で気になるところを先にお話をさせていただきたいと思います。まず食事について伺いたいと思いますが、普段はどのような食事をとられていますか。";
    const a = analyzeTurn(text);
    expect(a.checkupOpening).toBe(true);

    const detail = detectPersonaDetailRequest(text);
    expect(detail).not.toBeNull();
    expect(detail?.domain).toBe("diet");
    expect(detail?.dimension).toBe("items");

    const reply = generateRuleBasedReply(
      s,
      s.initialState,
      a,
      2,
      text,
      []
    );
    expect(reply).toMatch(/朝食|昼食|夕食|外食|家庭/);
    expect(reply).not.toBe("わかりました。お願いします。");
    expect(reply).not.toBe("はい、お願いします。");
  });

  it("recognizes a detailed breakfast question", () => {
    const req = detectPersonaDetailRequest(
      "朝食は具体的にどのようなものを食べていますか？"
    );
    expect(req?.key).toBe("diet.breakfast.items");
  });

  it("produces a concrete vegetable frequency rather than a vague frequency", () => {
    const s = barberScenario();
    const req = detectPersonaDetailRequest(
      "野菜は1週間のうち何日ぐらい食べていますか"
    );
    expect(req?.key).toBe("diet.vegetables.frequency");
    const detail = generatePersonaConsistentFallbackDetail(s, req!, {});
    expect(detail).toMatch(/週に[0-7０-７一二三四五六七]日/);
    expect(detail).toMatch(/野菜/);
  });

  it("converts negative vegetable-day wording into eating days", () => {
    const memory: PersonaSessionMemory = {
      "diet.vegetables.frequency":
        "野菜をほとんど食べない日は、週に2日くらいあります。",
    };
    const reply = checkProposalConsistency(
      "野菜を食べる日を1日増やして週3日とすることはできそうですか",
      memory
    );
    expect(reply).not.toBeNull();
    expect(reply).toMatch(/週に5日|今より減る|週6日/);
  });

  it("checks targets against nested dinner-vegetable frequency memory", () => {
    const memory: PersonaSessionMemory = {
      "diet.dinner.vegetables.frequency":
        "夕食では野菜を週に5日くらい食べています。",
    };
    const reply = checkProposalConsistency(
      "野菜を食べる日を1日増やして週3日とすることはできそうですか",
      memory
    );
    expect(reply).not.toBeNull();
    expect(reply).toMatch(/今より減る|週6日/);
  });

  it("detects an inconsistent vegetable target even with full-width digits", () => {
    const memory: PersonaSessionMemory = {
      "diet.vegetables.frequency":
        "野菜は週に5日くらいは食べています。ほとんど食べない日は週に2日くらいあります。",
    };
    const reply = checkProposalConsistency(
      "では、これからの目標として野菜を食べる日を１日増やして週3日とすることはできそうですか",
      memory
    );
    expect(reply).not.toBeNull();
    expect(reply).toMatch(/今より減る|意味でしょうか/);
  });

  it("recognizes inflected behavior proposals such as 増やして", () => {
    const a = analyzeTurn(
      "野菜を食べる日を１日増やして週6日とすることはできそうですか"
    );
    expect(a.behaviorProposal).toBe(true);
  });

  it("does not treat a PHN proposal alone as a self-selected goal", () => {
    const s = barberScenario();
    const text =
      "野菜を食べる日を1日増やして週6日とすることはできそうですか";
    const a = analyzeTurn(text);
    const afterPhn = updateState(s.initialState, a);
    expect(afterPhn.decisionStatus).not.toBe("self_selected_goal");

    const afterClient = updateStateFromClientReaction(
      afterPhn,
      a,
      "できるかもしれませんが、続けられるかはまだ自信がありません。"
    );
    expect(afterClient.decisionStatus).toBe("considering");
  });

  it("treats confidence-reason questions as barrier exploration", () => {
    const s = barberScenario();
    const text = "自信がない理由になにか心当たりはありますか";
    const a = analyzeTurn(text);
    const reply = generateRuleBasedReply(
      s,
      s.initialState,
      a,
      6,
      text,
      []
    );
    expect(reply).not.toMatch(/特に制約なし.*難しい/);
    expect(reply).toMatch(/仕事|時間|難しい/);
  });

  it("prioritizes change-goal exploration over a work keyword", () => {
    const s = barberScenario();
    const text =
      "理美容の仕事をされているんですね。では食事についてどのような内容なら少しずつ取り組めそうですか？";
    const a = analyzeTurn(text);
    expect(a.elicitsGoal).toBe(true);

    const reply = generateRuleBasedReply(
      s,
      s.initialState,
      a,
      7,
      text,
      []
    );
    expect(reply).toMatch(/食事|野菜|取り組|変え|試して/);
    expect(reply).not.toMatch(/^理美容師の仕事をしています/);
  });

  it("keeps dinner and vegetables as a nested dietary context", () => {
    const dinner = detectPersonaDetailRequest(
      "夕食は特にどのようなものを食べられていますか"
    );
    expect(dinner?.key).toBe("diet.dinner.items");

    const vegetablePresence = detectPersonaDetailRequest(
      "では夕食の時に野菜は食べていますか",
      dinner
    );
    expect(vegetablePresence?.key).toBe(
      "diet.dinner.vegetables.presence"
    );
    expect(vegetablePresence?.meal).toBe("dinner");
    expect(vegetablePresence?.food).toBe("vegetables");

    const amount = detectPersonaDetailRequest(
      "夕食の時に食べる野菜はどれぐらいの量ですか",
      vegetablePresence
    );
    expect(amount?.key).toBe("diet.dinner.vegetables.amount");
    expect(amount?.dimension).toBe("amount");
  });

  it("uses the corrected clause instead of earlier lunch references", () => {
    const req = detectPersonaDetailRequest(
      "昼食と夕食後どこで食べるかではなく夕食の時に野菜を食べているかといった質問です"
    );
    expect(req?.key).toBe("diet.dinner.vegetables.presence");
    expect(req?.isCorrection).toBe(true);
  });

  it("inherits dinner vegetable focus for a short amount follow-up", () => {
    const previous = detectPersonaDetailRequest(
      "夕食の時に野菜は食べていますか"
    );
    const amount = detectPersonaDetailRequest(
      "その野菜はどれくらいの量ですか",
      previous
    );
    expect(amount?.key).toBe("diet.dinner.vegetables.amount");
  });

  it("rejects a presence-only answer when vegetable amount was asked", () => {
    const request = detectPersonaDetailRequest(
      "夕食の時に食べる野菜はどれぐらいの量ですか"
    );
    expect(request).not.toBeNull();
    expect(
      isPersonaDetailAnswerValid(
        request!,
        "野菜は、夕食の食事の際に食べます。"
      )
    ).toBe(false);
    expect(
      isPersonaDetailAnswerValid(
        request!,
        "夕食では野菜は小鉢1皿くらいです。"
      )
    ).toBe(true);
  });

  it("returns a concrete amount after confirming dinner vegetables", () => {
    const s = barberScenario();
    const presence = detectPersonaDetailRequest(
      "夕食の時に野菜は食べていますか"
    )!;
    const memory: PersonaSessionMemory = {
      "diet.dinner.items":
        "夕食は家で、ご飯と主菜に野菜のおかずを一品付けています。",
    };
    const presenceReply = generatePersonaConsistentFallbackDetail(
      s,
      presence,
      memory
    );
    expect(presenceReply).toMatch(/夕食/);
    expect(presenceReply).toMatch(/野菜/);

    const amount = detectPersonaDetailRequest(
      "夕食の時に食べる野菜はどれぐらいの量ですか",
      presence
    )!;
    const amountReply = generatePersonaConsistentFallbackDetail(
      s,
      amount,
      {
        ...memory,
        [presence.key]: presenceReply,
      }
    );
    expect(amountReply).toMatch(/小鉢|皿|片手|品/);
    expect(amountReply).not.toBe(presenceReply);
  });

  it("preserves detailed exercise, sleep, alcohol, and work detection", () => {
    expect(
      detectPersonaDetailRequest("普段はどのような運動をしていますか")?.key
    ).toBe("exercise.activity.items");
    expect(
      detectPersonaDetailRequest("普段は何時ごろ寝ていますか")?.key
    ).toBe("sleep.bedtime.time");
    expect(
      detectPersonaDetailRequest("お酒は週に何回くらい飲みますか")?.key
    ).toBe("alcohol.pattern.frequency");
    expect(
      detectPersonaDetailRequest("仕事は具体的にどのような勤務ですか")?.key
    ).toBe("work.pattern.items");
  });

  it("does not leak dinner-vegetable context into a new alcohol topic", () => {
    const previous = detectPersonaDetailRequest(
      "夕食の時に野菜は食べていますか"
    );
    const alcohol = detectPersonaDetailRequest(
      "お酒は週に何回くらい飲みますか",
      previous
    );
    expect(alcohol?.key).toBe("alcohol.pattern.frequency");
  });

  it("keeps follow-up context across exercise details", () => {
    const exercise = detectPersonaDetailRequest(
      "普段はどのような運動をしていますか"
    );
    expect(exercise?.key).toBe("exercise.activity.items");

    const duration = detectPersonaDetailRequest(
      "それは1回何分くらいですか",
      exercise
    );
    expect(duration?.key).toBe("exercise.activity.duration");
    expect(duration?.domain).toBe("exercise");
  });

  it("detects detailed smoking, alcohol, and sleep questions", () => {
    expect(
      detectPersonaDetailRequest("たばこは1日何本くらい吸いますか")?.key
    ).toBe("smoking.use.amount");
    expect(
      detectPersonaDetailRequest("お酒はどこで飲むことが多いですか")?.key
    ).toBe("alcohol.pattern.context");
    expect(
      detectPersonaDetailRequest("睡眠時間は何時間くらいですか")?.key
    ).toBe("sleep.pattern.duration");
  });

  it("detects work, family, finance, and healthcare follow-ups", () => {
    expect(
      detectPersonaDetailRequest("仕事は何時ごろ終わりますか")?.key
    ).toBe("work.schedule.time");
    expect(
      detectPersonaDetailRequest("家族に協力してもらえそうですか")?.key
    ).toBe("family.relationship.support");
    expect(
      detectPersonaDetailRequest(
        "健康づくりで費用面で難しいことはありますか"
      )?.key
    ).toBe("finance.constraint.barrier");
    expect(
      detectPersonaDetailRequest("病院にはどうやって通っていますか")?.key
    ).toBe("healthcare.access.items");
  });

  it("detects checkup, stress, values, and motivation follow-ups", () => {
    expect(
      detectPersonaDetailRequest("これまで健診を受けたことはありますか")?.key
    ).toBe("checkup.result.history");
    expect(
      detectPersonaDetailRequest("ストレスになるのはなぜですか")?.key
    ).toBe("stress.context.reason");
    expect(
      detectPersonaDetailRequest("生活で大切にしていることは何ですか")?.key
    ).toBe("values.priority.items");
    expect(
      detectPersonaDetailRequest("続けられる自信はどのくらいありますか")?.key
    ).toBe("motivation.confidence.confidence");
  });

  it("grounds medical and social questions in expanded JMED persona fields", () => {
    const s = barberScenario();
    s.persona.pastMedicalHistory = "脂質異常症の指摘歴あり";
    s.persona.healthcareAccess = "自家用車で通院";
    s.persona.socialParticipation = "地域活動への参加は少ない";

    const medical = detectPersonaDetailRequest(
      "これまでに病気を指摘されたことはありますか"
    )!;
    const medicalEvidence = personaEvidenceForDetail(s, medical);
    expect(medicalEvidence).toContain("脂質異常症の指摘歴あり");

    const access = detectPersonaDetailRequest(
      "病院にはどうやって通っていますか"
    )!;
    expect(personaEvidenceForDetail(s, access)).toContain("自家用車で通院");

    const social = detectPersonaDetailRequest(
      "地域活動には参加していますか"
    )!;
    expect(personaEvidenceForDetail(s, social)).toContain(
      "地域活動への参加は少ない"
    );
  });

  it("rejects detail answers that do not answer the requested dimension", () => {
    const duration = detectPersonaDetailRequest(
      "運動は1回何分くらいしますか"
    )!;
    expect(isPersonaDetailAnswerValid(duration, "ウォーキングをしています。")).toBe(false);
    expect(isPersonaDetailAnswerValid(duration, "1回30分くらいです。")).toBe(true);

    const reason = detectPersonaDetailRequest(
      "運動が続かないのはなぜですか"
    )!;
    expect(isPersonaDetailAnswerValid(reason, "運動はあまりしていません。")).toBe(false);
    expect(
      isPersonaDetailAnswerValid(
        reason,
        "仕事が遅くなることが多いので、時間を取りにくいからです。"
      )
    ).toBe(true);
  });

  it("tracks subtopics across major health guidance lifestyle domains", () => {
    const walking = detectPersonaDetailRequest(
      "ウォーキングは普段どのようにしていますか"
    );
    expect(walking?.key).toBe("exercise.walking.items");

    const walkingDuration = detectPersonaDetailRequest(
      "それは1回何分くらいですか",
      walking
    );
    expect(walkingDuration?.key).toBe("exercise.walking.duration");

    expect(
      detectPersonaDetailRequest("たばこは紙巻きを1日何本くらい吸いますか")?.key
    ).toBe("smoking.cigarette.amount");

    expect(
      detectPersonaDetailRequest("寝つきはどうですか")?.key
    ).toBe("sleep.onset.detail");

    expect(
      detectPersonaDetailRequest("残業は週に何回くらいありますか")?.key
    ).toBe("work.overtime.frequency");

    expect(
      detectPersonaDetailRequest("通院はどのような交通手段ですか")?.key
    ).toBe("healthcare.transport.items");
  });

  it("covers motivational interviewing follow-up dimensions", () => {
    expect(
      detectPersonaDetailRequest("生活を変えることはどのくらい重要だと思いますか")?.dimension
    ).toBe("importance");
    expect(
      detectPersonaDetailRequest("今どのくらい取り組む準備ができていますか")?.dimension
    ).toBe("readiness");
    expect(
      detectPersonaDetailRequest("変えたらどんな良いことがありそうですか")?.dimension
    ).toBe("benefit");
    expect(
      detectPersonaDetailRequest("逆に変えることで困ることはありますか")?.dimension
    ).toBe("disadvantage");
    expect(
      detectPersonaDetailRequest("続けるにはどんな工夫ができそうですか")?.dimension
    ).toBe("strategy");
  });

  it("uses subject-specific checkup evidence instead of unrelated values", () => {
    const s = barberScenario();
    s.persona.weight = "78 kg";
    s.persona.bmi = "26.1";
    s.persona.vitalSigns = "血圧 142/88 mmHg";
    s.persona.bloodTests = "HbA1c 6.1%、LDL 155 mg/dL";

    const bp = detectPersonaDetailRequest("血圧はどのくらいでしたか")!;
    expect(bp.key).toBe("checkup.blood_pressure.amount");
    const bpEvidence = personaEvidenceForDetail(s, bp);
    expect(bpEvidence).toContain("142/88");
    expect(bpEvidence).not.toContain("26.1");
    expect(bpEvidence).not.toContain("HbA1c");

    const hba1c = detectPersonaDetailRequest("HbA1cはどのくらいでしたか")!;
    expect(hba1c.key).toBe("checkup.hba1c.amount");
    const hba1cEvidence = personaEvidenceForDetail(s, hba1c);
    expect(hba1cEvidence).toContain("HbA1c 6.1");
    expect(hba1cEvidence).not.toContain("142/88");
  });

  it("does not fabricate fact-locked medical details when persona evidence is absent", () => {
    const s = barberScenario();
    s.persona.medications = "";
    s.persona.medicationAdherence = "";
    const medication = detectPersonaDetailRequest(
      "薬は何を何回飲んでいますか"
    )!;
    const reply = generatePersonaConsistentFallbackDetail(
      s,
      medication,
      {},
      s.initialState
    );
    expect(reply).toMatch(/分から|わから|意識していない|答えにく/);
    expect(reply).not.toMatch(/mg|錠|1日[0-9１-９]/);
  });

  it("keeps a generated lifestyle detail stable within the same persona session", () => {
    const s = barberScenario();
    const request = detectPersonaDetailRequest(
      "ウォーキングは1回何分くらいですか"
    )!;
    const first = generatePersonaConsistentFallbackDetail(
      s,
      request,
      {},
      s.initialState
    );
    const memory: PersonaSessionMemory = { [request.key]: first };
    const second = generatePersonaConsistentFallbackDetail(
      s,
      request,
      memory,
      s.initialState
    );
    expect(second).toBe(first);
  });

  it("normalizes record-like sentence endings", () => {
    expect(
      normalizeClientSpeech("朝食は家庭で食べることが多い")
    ).toBe("朝食は家庭で食べることが多いです。");
  });
});
