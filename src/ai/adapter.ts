import * as webllm from "@mlc-ai/web-llm";
import { ConversationState, Message, Scenario, TurnAnalysis } from "../domain/types";

export type AIReplyInput = {
  scenario: Scenario;
  state: ConversationState;
  analysis: TurnAnalysis;
  messages: Message[];
  latestUserText: string;
  groundedSeed: string;
};

export type AIProgress = {
  text: string;
  progress?: number;
};

const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

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

【厳守】
- 対象者としてのみ返答する。保健師を指導・評価しない。
- 発話量がlowなら1文程度、mediumなら1〜2文、highなら2〜3文を目安にする。
- 質問された内容に直接答える。
- 上記にない病名、検査値、家族歴、服薬、生活歴を作らない。
- 本人だけが知っている背景は、保健師が関連する質問をした場合、または情報開示が十分高まった場合だけ話す。
- 抵抗が高い時は簡単に同意しない。
- 行動準備性や自己効力感が低い時は、すぐに具体的な目標を約束しない。
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
        "\n\n【今回の返答で必ず守る内容】\n" +
        input.groundedSeed +
        "\n\n上の内容だけを、対象者本人の自然な話し言葉に短く言い換えてください。新しい事実は追加しないでください。質問返しだけで終わらず、保健師の直前の問いに直接答えてください。『〜しましょう』『〜しましょうね』『サポートします』『お手伝いします』『教えていただければ』など、支援者側の表現は絶対に使わないでください。",
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

export async function unloadLocalAI(): Promise<void> {
  if (engine) {
    await engine.unload();
    engine = null;
  }
}
