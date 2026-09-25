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

  it("normalizes record-like sentence endings", () => {
    expect(
      normalizeClientSpeech("朝食は家庭で食べることが多い")
    ).toBe("朝食は家庭で食べることが多いです。");
  });
});
