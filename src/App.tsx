import { useMemo, useRef, useState } from "react";
import { scenarios } from "./data/scenarios";
import { ConversationState, Message, TurnAnalysis } from "./domain/types";
import { analyzeTurn } from "./engine/analyze";
import { updateState } from "./engine/state";
import { generateRuleBasedReply } from "./engine/reply";
import { buildFeedback } from "./engine/feedback";

const names: Record<keyof ConversationState, string> = {
  trust: "信頼",
  readiness: "行動準備性",
  resistance: "抵抗",
  selfEfficacy: "自己効力感",
  disclosure: "情報開示",
  concern: "健康への関心",
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionErrorLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export default function App() {
  const [id, setId] = useState(scenarios[0].id);
  const scenario = useMemo(() => scenarios.find((x) => x.id === id) ?? scenarios[0], [id]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [analyses, setAnalyses] = useState<TurnAnalysis[]>([]);
  const [state, setState] = useState<ConversationState>(scenario.initialState);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const startTraining = (next = id) => {
    const selected = scenarios.find((x) => x.id === next) ?? scenarios[0];
    setMessages([]);
    setAnalyses([]);
    setState(selected.initialState);
    setInput("");
    setStarted(true);
    setFinished(false);
    setListening(false);
    setSpeechStatus("");
  };

  const chooseScenario = (value: string) => {
    setId(value);
    startTraining(value);
  };

  const send = () => {
    const text = input.trim();
    if (!text || finished) return;

    const analysis = analyzeTurn(text);
    const nextState = updateState(state, analysis);
    const turn = analyses.length + 1;
    const reply = generateRuleBasedReply(scenario, nextState, analysis, turn, text);

    setMessages((prev) => [
      ...prev,
      { role: "phn", text },
      { role: "client", text: reply },
    ]);
    setAnalyses((prev) => [...prev, analysis]);
    setState(nextState);
    setInput("");
  };

  const toggleSpeech = () => {
    if (!speechSupported) {
      setSpeechStatus("このブラウザでは音声入力に対応していません。Chrome または Edge の最新版をお試しください。");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setSpeechStatus("音声を聞いています…");
    };

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSpeechStatus("マイクの使用が許可されていません。ブラウザのサイト設定でマイクを許可してください。");
      } else if (event.error === "no-speech") {
        setSpeechStatus("音声を認識できませんでした。もう一度お試しください。");
      } else {
        setSpeechStatus(`音声入力でエラーが発生しました（${event.error}）。`);
      }
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setSpeechStatus((current) =>
        current === "音声を聞いています…" ? "音声入力が終了しました。内容を確認して送信してください。" : current
      );
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const feedback = finished ? buildFeedback(messages, analyses) : null;

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">G-CHAM / Public Health Nursing Simulation</p>
          <h1>G-CHAM PHN Conversation Trainer</h1>
          <p>特定保健指導の対象者との対話を、対象者背景と会話状態の変化を踏まえて練習する教育用プロトタイプです。</p>
        </div>
        <span className="badge">MVP 0.2</span>
      </header>

      <section className="panel">
        <label>ケース</label>
        <select value={id} onChange={(e) => chooseScenario(e.target.value)}>
          {scenarios.map((x) => (
            <option key={x.id} value={x.id}>{x.difficulty}｜{x.title}</option>
          ))}
        </select>

        <div className="grid">
          <div>
            <h2>{scenario.title}</h2>
            <p>{scenario.supportType}・{scenario.difficulty}</p>
            <ul>{scenario.publicContext.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3>学習目標</h3>
            <ul>{scenario.learningObjectives.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="panel">
          <div className="head">
            <h2>会話</h2>
            <button className="secondary" onClick={() => startTraining()}>最初から</button>
          </div>

          {!started ? (
            <div className="empty">
              <p>対象者を迎える場面から始まります。</p>
              <p className="small">保健師から挨拶、自己紹介、面接の導入を行ってください。</p>
              <button onClick={() => startTraining()}>トレーニング開始</button>
            </div>
          ) : (
            <>
              <div className="scenarioCue">
                <span>場面</span>
                <p>対象者が着席しました。あなたから会話を始めてください。</p>
              </div>

              <div className="messages">
                {messages.length === 0 && (
                  <p className="conversationHint">普段の特定保健指導と同じように、まず挨拶から始めてください。</p>
                )}
                {messages.map((x, i) => (
                  <div key={i} className={"msg " + x.role}>
                    <small>{x.role === "phn" ? "保健師" : "対象者"}</small>
                    <p>{x.text}</p>
                  </div>
                ))}
              </div>

              {!finished && (
                <>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="対象者に話しかけてください"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />

                  <div className="voiceRow">
                    <button
                      type="button"
                      className={listening ? "voice active" : "voice secondary"}
                      onClick={toggleSpeech}
                      aria-pressed={listening}
                    >
                      {listening ? "■ 音声入力を停止" : "🎙 音声で入力"}
                    </button>
                    <span className="small">
                      {speechSupported ? "日本語音声をテキスト化します。" : "このブラウザは音声入力に未対応です。"}
                    </span>
                  </div>

                  {speechStatus && <p className="speechStatus" role="status">{speechStatus}</p>}

                  <div className="actions">
                    <button onClick={send}>送信</button>
                    <button className="secondary" onClick={() => setFinished(true)}>面接を終了して振り返る</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <aside className="panel">
          <h2>トレーニング中の状態</h2>
          <p className="small">教育用の内部モデルであり心理尺度ではありません。</p>
          {(Object.keys(state) as (keyof ConversationState)[]).map((key) => (
            <div className="metric" key={key}>
              <div><span>{names[key]}</span><span>{state[key]}</span></div>
              <progress max="100" value={state[key]} />
            </div>
          ))}
          <h3>対象者背景</h3>
          <p>{scenario.persona.age}歳・{scenario.persona.sex}／{scenario.persona.occupation}</p>
          <p>{scenario.persona.exercise}／{scenario.persona.diet}</p>
        </aside>
      </section>

      {feedback && (
        <section className="panel feedback">
          <h2>振り返り</h2>
          <div className="grid3">
            <div><h3>できていた点</h3><ul>{feedback.strengths.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h3>改善できる点</h3><ul>{feedback.improvements.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div><h3>未確認・次の課題</h3><ul>{feedback.unresolved.map((x) => <li key={x}>{x}</li>)}</ul></div>
          </div>
        </section>
      )}

      <footer>
        参考設計：厚生労働省「標準的な健診・保健指導プログラム（令和6年度版）」。JMED-Personas利用時はCC BY 4.0に基づき出典を表示します。
      </footer>
    </main>
  );
}
