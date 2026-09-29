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
    ).toBe("sleep.pattern.time");
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

  it("normalizes record-like sentence endings", () => {
    expect(
      normalizeClientSpeech("朝食は家庭で食べることが多い")
    ).toBe("朝食は家庭で食べることが多いです。");
  });
});
