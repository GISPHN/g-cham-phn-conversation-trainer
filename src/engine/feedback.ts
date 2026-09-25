import {
  ConversationState,
  Feedback,
  Message,
  TurnAnalysis,
} from "../domain/types";

export function buildFeedback(
  messages: Message[],
  analyses: TurnAnalysis[],
  state?: ConversationState
): Feedback {
  const strengths: string[] = [];
  const improvements: string[] = [];
  const unresolved: string[] = [];
  const n = (k: keyof TurnAnalysis) =>
    analyses.filter((x) => Boolean(x[k])).length;

  if (n("openQuestion") >= 2) {
    strengths.push("開かれた質問を複数回使用し、対象者が背景を語る余地を作っています。");
  }
  if (n("reflection") >= 1) {
    strengths.push("対象者の発言を受け止める応答が含まれています。");
  }
  if (n("autonomySupport") >= 1) {
    strengths.push("対象者自身が行動を選択する余地を残した支援ができています。");
  }

  if (state && state.disclosure >= 55 && state.trust >= 55) {
    strengths.push(
      "行動目標の決定だけでなく、信頼形成と情報開示を進められています。"
    );
  }

  if (
    state &&
    state.structuralBarrier >= 65 &&
    state.decisionStatus !== "self_selected_goal"
  ) {
    strengths.push(
      "構造的な制約が大きい対象者では、面接中に行動目標へ到達しないこと自体を失敗とはみなしません。"
    );
  }

  if (n("directive") >= 2) {
    improvements.push(
      "指示的な表現が複数あります。提案の前に本人の考えや実行可能性を確認してください。"
    );
  }
  if (n("reflection") === 0) {
    improvements.push("対象者の言葉を要約、反映する応答を追加する余地があります。");
  }
  if (n("autonomySupport") === 0) {
    improvements.push("本人が選択できる問いかけを追加する余地があります。");
  }

  if (state && state.structuralBarrier >= 65 && n("openQuestion") < 2) {
    improvements.push(
      "時間、経済、家族、仕事など、本人の努力だけでは変えにくい背景をさらに探索する余地があります。"
    );
  }

  if (state?.decisionStatus === "self_selected_goal") {
    strengths.push("対象者自身が選択した行動目標まで到達しています。");
  } else if (state?.decisionStatus === "tentative_decision") {
    unresolved.push(
      "対象者は行動を検討し始めています。実行可能性と障壁を確認して次回支援につなげる段階です。"
    );
  } else if (state?.decisionStatus === "considering") {
    unresolved.push(
      "対象者は検討段階にあります。目標設定を急がず、重要度・自信・生活上の制約を整理する余地があります。"
    );
  } else if (state?.decisionStatus === "ambivalent") {
    unresolved.push(
      "対象者には迷いが残っています。変わりたい理由と変えにくい理由の両方を扱う余地があります。"
    );
  }

  if (messages.filter((m) => m.role === "phn").length < 4) {
    unresolved.push(
      "生活背景や行動変容の準備状態を十分に確認できていない可能性があります。"
    );
  }

  if (!strengths.length) {
    strengths.push("健診結果や生活習慣について対話を開始できています。");
  }

  return { strengths, improvements, unresolved };
}
