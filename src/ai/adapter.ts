import * as webllm from "@mlc-ai/web-llm";
import { ConversationState, Message, Scenario, TurnAnalysis } from "../domain/types";
import { formatSessionMemory, PersonaDetailRequest, PersonaSessionMemory } from "../engine/personaMemory";

export type AIReplyInput = {
  scenario: Scenario;
  state: ConversationState;
  analysis: TurnAnalysis;
  messages: Message[];
  latestUserText: string;
  groundedSeed: string;
  sessionMemory?: PersonaSessionMemory;
};

export type PersonaDetailInput = {
  scenario: Scenario;
  state: ConversationState;
  messages: Message[];
  latestUserText: string;
  request: PersonaDetailRequest;
  evidence: string;
  sessionMemory: PersonaSessionMemory;
};

export type AIProgress = {
  text: string;
  progress?: number;
};

const MODEL_ID = "gemma-2-2b-jpn-it-q4f16_1-MLC";

let engine: webllm.MLCEngineInterface | null = null;
let loadingPromise: Promise<webllm.MLCEngineInterface> | null = null;

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function getLocalModelId(): string {
  return MODEL_ID;
}

export async function initLocalAI(
  onProgress?: (progress: AIProgress) => void
): Promise<webllm.MLCEngineInterface> {
  if (engine) return engine;
  if (loadingPromise) return loadingPromise;

  loadingPromise = webllm.CreateMLCEngine(MODEL_ID, {
    initProgressCallback: (report) => {
      onProgress?.({
        text: report.text,
        progress: typeof report.progress === "number" ? report.progress : undefined,
      });
    },
    logLevel: "WARN",
  });

  try {
    engine = await loadingPromise;
    return engine;
  } finally {
    loadingPromise = null;
  }
}

function personaPrompt(s: Scenario, st: ConversationState): string {
  const p = s.persona;
  return `
あなたは特定保健指導を受ける日本人の対象者です。保健師ではありません。
以下の人物として自然な日本語で応答してください。

【人物背景】
年齢: ${p.age}歳
性別: ${p.sex}
職業: ${p.occupation}
健康リテラシー: ${p.healthLiteracy}
経済的制約: ${p.economicConstraint}
世帯: ${p.household}
家族関係: ${p.familyRelationship}
喫煙: ${p.smoking}
飲酒: ${p.alcohol}
運動: ${p.exercise}
食生活: ${p.diet}
睡眠: ${p.sleep}
本人が大切にしていること: ${p.values}
教育歴: ${p.education ?? ""}
居住都道府県: ${p.prefecture ?? ""}
社会参加・孤立: ${p.socialParticipation ?? ""}
Big Five: ${p.bigFive ?? ""}
発話量: ${p.talkativeness ?? "medium"}
自発性: ${p.initiative ?? "medium"}

【今回の健診・支援場面】
${s.publicContext.join("。")}

【本人だけが知っている背景】
${s.hiddenContext.join("。")}

【現在の会話状態】
信頼 ${st.trust}/100
行動準備性 ${st.readiness}/100
抵抗 ${st.resistance}/100
自己効力感 ${st.selfEfficacy}/100
情報開示 ${st.disclosure}/100
健康への関心 ${st.concern}/100
重要度 ${st.importance}/100
実行への自信 ${st.confidence}/100
構造的障壁 ${st.structuralBarrier}/100
社会的支援 ${st.socialSupport}/100
時間的制約 ${st.timeConstraint}/100
経済的制約 ${st.financialConstraint}/100
意思決定状態 ${st.decisionStatus}

【厳守】
- 対象者としてのみ返答する。保健師を指導・評価しない。
- 発話量がlowなら1文程度、mediumなら1〜2文、highなら2〜3文を目安にする。
- 質問された内容に直接答える。
- 上記にない病名、検査値、家族歴、服薬、生活歴を作らない。
- 通常の応答では、食品名、食事回数、量、時間、運動内容など人物背景にない具体的事実を勝手に追加しない。ただし、system prompt内に【今回の詳細生成】がある場合のみ、既知の人物背景と既存の追加設定に矛盾しない日常生活上の細部を補完してよい。
- 同じ話題を続けて質問された場合は、直前の返答をそのまま繰り返さず、質問された下位項目だけに答える。
- 本人だけが知っている背景は、保健師が関連する質問をした場合、または情報開示が十分高まった場合だけ話す。
- 抵抗が高い時は簡単に同意しない。
- 行動準備性や自己効力感が低い時は、すぐに具体的な目標を約束しない。
- 構造的障壁、時間的制約、経済的制約が高い場合、本人の意欲だけで解決できるような返答をしない。
- 意思決定状態がambivalentまたはconsideringなら、無理に「やります」と決断しない。
- socialSupportが低い場合、家族や周囲の支援が当然に得られる前提で話さない。
- 日本の実際の保健指導場面として不自然な説明口調を避ける。\n- 対象者の発話は原則として自然な丁寧体にし、「〜る。」「〜である。」のような記録文調をそのまま使わない。\n- 自発性がhighなら質問された内容に加えて関連する背景を1点程度補足してよい。lowなら聞かれたことだけに短く答える。
`.trim();
}

export async function generateLocalAIReply(input: AIReplyInput): Promise<string> {
  if (!engine) throw new Error("LOCAL_AI_NOT_READY");

  const recent = input.messages.slice(-4).map((m) => ({
    role: m.role === "phn" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));

  const messages: webllm.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        personaPrompt(input.scenario, input.state) +
        "\n\n【この会話中に確定した追加設定】\n" +
        formatSessionMemory(input.sessionMemory ?? {}) +
        "\n\n【今回の返答で必ず守る内容】\n" +
        input.groundedSeed +
        "\n\n上の内容と人物背景に明示された事実だけを使い、対象者本人の自然な話し言葉に短く言い換えてください。新しい具体的事実は追加しないでください。人物背景に答えがない細部については、推測して埋めず、自然に「そこまでは意識していない」「はっきりとは分からない」と答えてください。質問返しだけで終わらず、保健師の直前の問いに直接答えてください。『〜しましょう』『〜しましょうね』『サポートします』『お手伝いします』『教えていただければ』など、支援者側の表現は絶対に使わないでください。",
    },
    ...recent,
    { role: "user", content: input.latestUserText },
  ];

  const response = await engine.chat.completions.create({
    messages,
    temperature: 0.2,
    top_p: 0.75,
    max_tokens: 64,
    repetition_penalty: 1.05,
  });

  if ("choices" in response) {
    const text = response.choices[0]?.message?.content?.trim();
    if (text) {
      const forbidden = [
        "しましょう",
        "しましょうね",
        "サポートします",
        "サポートできます",
        "お手伝いします",
        "お手伝いできます",
        "教えていただければ",
        "いかがでしょう",
        "健康状態について教えて",
      ];

      const numbers = text.match(/\d+(?:\.\d+)?/g) ?? [];
      const allowedNumberText =
        input.groundedSeed + " " + input.latestUserText;
      const hasNewNumber = numbers.some(
        (value) => !allowedNumberText.includes(value)
      );

      const protectedTerms = [
        "高血圧",
        "糖尿病",
        "脂質異常",
        "心筋梗塞",
        "脳卒中",
        "がん",
        "薬",
        "服薬",
        "HbA1c",
        "LDL",
        "中性脂肪",
      ];
      const hasNewProtectedFact = protectedTerms.some(
        (term) =>
          text.includes(term) &&
          !input.groundedSeed.includes(term) &&
          !input.latestUserText.includes(term)
      );

      const tooLong =
        text.length > Math.max(90, input.groundedSeed.length * 1.8);

      if (
        !forbidden.some((phrase) => text.includes(phrase)) &&
        !hasNewNumber &&
        !hasNewProtectedFact &&
        !tooLong
      ) {
        return text;
      }
    }
  }

  throw new Error("LOCAL_AI_REPLY_REJECTED");
}


export async function generatePersonaDetail(
  input: PersonaDetailInput
): Promise<string> {
  if (!engine) throw new Error("LOCAL_AI_NOT_READY");

  const recent = input.messages.slice(-6).map((m) => ({
    role: m.role === "phn" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));

  const prompt =
    personaPrompt(input.scenario, input.state) +
    "\n\n【この会話中にすでに確定した追加設定】\n" +
    formatSessionMemory(input.sessionMemory) +
    "\n\n【今回の詳細生成】\n" +
    `対象項目: ${input.request.label}\n` +
    `JMED-Personas由来の関連情報: ${input.evidence || "明示なし"}\n` +
    `保健師の質問: ${input.latestUserText}\n\n` +
    "人物背景と既存の追加設定に矛盾しない範囲で、質問された下位項目そのものに直接答える具体的な内容を1〜2文で生成してください。" +
    "ここでは会話シミュレーションの一貫性を保つため、食品名、選び方、時間帯、頻度などの生活上の細部を補って構いません。" +
    "ただし病名、検査値、服薬、家族歴、収入額など医学的・社会経済的な新規事実は作らないでください。" +
    "一度ここで決めた内容は以後この対象者の設定として固定されるため、既存設定と整合させてください。" +
    "保健師が『ではなく』『違う』『聞いているのは』などと訂正している場合は、その訂正を最優先し、直前の誤った回答を繰り返さないでください。" +
    "例えば『麺類の具体的なメニュー』を聞かれたら、ご飯や主食一般ではなく、うどん・そば・ラーメン等の麺料理について答えてください。" +
    "対象者本人の自然な日本語だけを返し、説明や箇条書き、JSONは出力しないでください。";

  const messages: webllm.ChatCompletionMessageParam[] = [
    { role: "system", content: prompt },
    ...recent,
    { role: "user", content: input.latestUserText },
  ];

  const response = await engine.chat.completions.create({
    messages,
    temperature: 0.35,
    top_p: 0.8,
    max_tokens: 72,
    repetition_penalty: 1.05,
  });

  if ("choices" in response) {
    const text = response.choices[0]?.message?.content?.trim();
    if (text && text.length <= 220) {
      const forbiddenMedical = [
        "HbA1c",
        "LDL",
        "中性脂肪",
        "糖尿病",
        "高血圧",
        "服薬",
        "薬を",
      ];
      const introducedMedical = forbiddenMedical.some(
        (term) =>
          text.includes(term) &&
          !input.evidence.includes(term) &&
          !input.latestUserText.includes(term)
      );
      if (!introducedMedical) return text;
    }
  }

  throw new Error("PERSONA_DETAIL_GENERATION_REJECTED");
}

export async function unloadLocalAI(): Promise<void> {
  if (engine) {
    await engine.unload();
    engine = null;
  }
}
