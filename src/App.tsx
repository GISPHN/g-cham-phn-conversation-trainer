import { useEffect, useMemo, useRef, useState } from "react";
import { scenarios } from "./data/scenarios";
import { loadJmedPersona, withPersona } from "./data/jmed";
import { ConversationState, Message, Persona, TurnAnalysis } from "./domain/types";
import { analyzeTurn } from "./engine/analyze";
import { deriveInitialState, updateState } from "./engine/state";
import {
  buildGroundedReplySeed,
  generateRuleBasedReply,
  normalizeClientSpeech,
  shouldBypassAI,
} from "./engine/reply";
import { buildFeedback } from "./engine/feedback";
import {
  generateLocalAIReply,
  generatePersonaDetail,
  getLocalModelId,
  initLocalAI,
  isWebGPUSupported,
} from "./ai/adapter";
import {
  detectPersonaDetailRequest,
  personaEvidenceForDetail,
  PersonaSessionMemory,
} from "./engine/personaMemory";

const numericStateKeys = [
  "trust",
  "readiness",
  "resistance",
  "selfEfficacy",
  "disclosure",
  "concern",
  "importance",
  "confidence",
  "structuralBarrier",
  "socialSupport",
  "timeConstraint",
  "financialConstraint",
] as const;

const names: Record<(typeof numericStateKeys)[number], string> = {
  trust: "信頼",
  readiness: "行動準備性",
  resistance: "抵抗",
  selfEfficacy: "自己効力感",
  disclosure: "情報開示",
  concern: "健康への関心",
  importance: "重要度",
  confidence: "実行への自信",
  structuralBarrier: "構造的障壁",
  socialSupport: "社会的支援",
  timeConstraint: "時間的制約",
  financialConstraint: "経済的制約",
};

const decisionLabels: Record<ConversationState["decisionStatus"], string> = {
  not_considering: "まだ考えていない",
  ambivalent: "迷いがある",
  considering: "検討している",
  tentative_decision: "やってみようかと考えている",
  self_selected_goal: "本人が目標を選択した",
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

type AIStatus = "off" | "loading" | "ready" | "error";
type PersonaStatus = "idle" | "loading" | "ready" | "fallback";

export default function App() {
  const [id, setId] = useState(scenarios[0].id);
  const baseScenario = useMemo(
    () => scenarios.find((x) => x.id === id) ?? scenarios[0],
    [id]
  );

  const [activePersona, setActivePersona] = useState<Persona>(baseScenario.persona);
  const [personaStatus, setPersonaStatus] = useState<PersonaStatus>("idle");
  const [personaMessage, setPersonaMessage] = useState("");

  const scenario = useMemo(
    () => withPersona(baseScenario, activePersona),
    [baseScenario, activePersona]
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [analyses, setAnalyses] = useState<TurnAnalysis[]>([]);
  const [state, setState] = useState<ConversationState>(baseScenario.initialState);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState("");
  const [readAloud, setReadAloud] = useState(true);
  const [aiStatus, setAIStatus] = useState<AIStatus>("off");
  const [aiProgress, setAIProgress] = useState("");
  const [aiProgressValue, setAIProgressValue] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sessionMemory, setSessionMemory] = useState<PersonaSessionMemory>({});

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const synthesisSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const webgpuSupported = isWebGPUSupported();

  useEffect(() => {
    const el = messageScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [messages, generating]);

  useEffect(() => {
    setActivePersona(baseScenario.persona);
    setPersonaStatus("idle");
    setPersonaMessage("");
  }, [baseScenario]);

  const speakClient = (text: string) => {
    if (!readAloud || !synthesisSupported || !text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 1.02;
    utterance.pitch = scenario.persona.sex.includes("男性") ? 0.96 : 1.02;

    const voices = window.speechSynthesis
      .getVoices()
      .filter((voice) => voice.lang.toLowerCase().startsWith("ja"));

    const preferred =
      voices.find((voice) => /Online.*Natural|Natural/i.test(voice.name)) ??
      voices.find((voice) => /Nanami|Keita/i.test(voice.name)) ??
      voices.find((voice) => /Google.*日本語|Google Japanese/i.test(voice.name)) ??
      voices.find((voice) => /Haruka|Ichiro|Kyoko|Otoya/i.test(voice.name)) ??
      voices[0];

    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  };

  const resetConversation = (selected = baseScenario) => {
    if (synthesisSupported) window.speechSynthesis.cancel();
    setMessages([]);
    setAnalyses([]);
    setState(selected.initialState);
    setInput("");
    setStarted(true);
    setFinished(false);
    setListening(false);
    setSpeechStatus("");
    setGenerating(false);
    setSessionMemory({});
  };

  const loadPersonaAndStart = async (selected = baseScenario) => {
    setPersonaStatus("loading");
    setPersonaMessage("JMED-Personasから対象者背景を取得しています…");
    setStarted(false);

    try {
      const persona = await loadJmedPersona(selected);
      setActivePersona(persona);
      setPersonaStatus("ready");
      setPersonaMessage(
        `JMED-Personas実データを使用中（ID: ${persona.sourceId?.slice(0, 8) ?? "unknown"}…）`
      );
      const personalizedState = deriveInitialState(selected.initialState, persona);
      if (synthesisSupported) window.speechSynthesis.cancel();
      setMessages([]);
      setAnalyses([]);
      setState(personalizedState);
      setInput("");
      setStarted(true);
      setFinished(false);
      setListening(false);
      setSpeechStatus("");
      setGenerating(false);
      setSessionMemory({});
    } catch (error) {
      console.error(error);
      setActivePersona(selected.persona);
      setPersonaStatus("fallback");
      setPersonaMessage(
        "JMED-Personasを取得できなかったため、内蔵デモペルソナを使用しています。"
      );
      resetConversation(selected);
    }
  };

  const chooseScenario = (value: string) => {
    const selected = scenarios.find((x) => x.id === value) ?? scenarios[0];
    setId(value);
    setActivePersona(selected.persona);
    setPersonaStatus("idle");
    setPersonaMessage("");
    setMessages([]);
    setAnalyses([]);
    setState(selected.initialState);
    setStarted(false);
    setFinished(false);
    setSessionMemory({});
  };

  const enableLocalAI = async () => {
    if (!webgpuSupported) {
      setAIStatus("error");
      setAIProgress(
        "このブラウザまたは端末ではWebGPUを利用できません。ルールベース会話を継続して利用できます。"
      );
      return;
    }

    setAIStatus("loading");
    setAIProgress("ローカルAIを準備しています…");
    setAIProgressValue(0);

    try {
      await initLocalAI((progress) => {
        setAIProgress(progress.text);
        setAIProgressValue(
          typeof progress.progress === "number"
            ? Math.round(progress.progress * 100)
            : null
        );
      });
      setAIStatus("ready");
      setAIProgress("ローカルAIの準備が完了しました。複雑な質問だけAIで自然化します。");
      setAIProgressValue(100);
    } catch (error) {
      console.error(error);
      setAIStatus("error");
      setAIProgress("ローカルAIを読み込めませんでした。ルールベース会話を使用します。");
      setAIProgressValue(null);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || finished || generating) return;

    const analysis = analyzeTurn(text);
    const nextState = updateState(state, analysis);
    const turn = analyses.length + 1;
    const phnMessage: Message = { role: "phn", text };

    setMessages((prev) => [...prev, phnMessage]);
    setAnalyses((prev) => [...prev, analysis]);
    setState(nextState);
    setInput("");
    setGenerating(true);

    const detailRequest = detectPersonaDetailRequest(text);
    const rememberedDetail = detailRequest
      ? sessionMemory[detailRequest.key]
      : undefined;

    let groundedSeed =
      rememberedDetail ??
      buildGroundedReplySeed(
        scenario,
        nextState,
        analysis,
        turn,
        text,
        messages
      );

    let replyText = groundedSeed;

    if (detailRequest && !rememberedDetail) {
      try {
        if (aiStatus !== "ready") {
          setAIStatus("loading");
          setAIProgress("詳細な対象者設定を生成するため、ローカルAIを準備しています…");
          setAIProgressValue(0);
          await initLocalAI((progress) => {
            setAIProgress(progress.text);
            setAIProgressValue(
              typeof progress.progress === "number"
                ? Math.round(progress.progress * 100)
                : null
            );
          });
          setAIStatus("ready");
          setAIProgress("ローカルAIの準備が完了しました。");
          setAIProgressValue(100);
        }

        const generatedDetail = await generatePersonaDetail({
          scenario,
          state: nextState,
          messages,
          latestUserText: text,
          request: detailRequest,
          evidence: personaEvidenceForDetail(scenario, detailRequest),
          sessionMemory,
        });

        const normalizedDetail = normalizeClientSpeech(generatedDetail);
        setSessionMemory((prev) => ({
          ...prev,
          [detailRequest.key]: normalizedDetail,
        }));
        groundedSeed = normalizedDetail;
        replyText = normalizedDetail;
      } catch (error) {
        console.warn(
          "Persona detail generation rejected; using grounded reply.",
          error
        );
        setAIStatus("error");
      }
    } else {
      const useAI = aiStatus === "ready" && !shouldBypassAI(text);

      if (useAI) {
        try {
          replyText = await generateLocalAIReply({
            scenario,
            state: nextState,
            analysis,
            messages,
            latestUserText: text,
            groundedSeed,
            sessionMemory,
          });
        } catch (error) {
          console.warn("AI reply rejected; using grounded reply.", error);
          replyText = groundedSeed;
        }
      }
    }

    const finalReply = normalizeClientSpeech(replyText);
    setMessages((prev) => [...prev, { role: "client", text: finalReply }]);
    setGenerating(false);
    speakClient(finalReply);
  };

  const toggleSpeech = () => {
    if (!speechSupported) {
      setSpeechStatus(
        "このブラウザでは音声入力に対応していません。Chrome または Edge の最新版をお試しください。"
      );
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
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
        setSpeechStatus(
          "マイクの使用が許可されていません。ブラウザのサイト設定でマイクを許可してください。"
        );
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
        current === "音声を聞いています…"
          ? "音声入力が終了しました。内容を確認して送信してください。"
          : current
      );
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const feedback = finished ? buildFeedback(messages, analyses, state) : null;

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">G-CHAM / Public Health Nursing Simulation</p>
          <h1>G-CHAM PHN Conversation Trainer</h1>
          <p>
            特定保健指導の対象者との対話を、対象者背景と会話状態の変化を踏まえて練習する教育用プロトタイプです。
          </p>
        </div>
        <span className="badge">MVP 0.5.3</span>
      </header>

      <section className="panel">
        <label>ケース</label>
        <select value={id} onChange={(e) => chooseScenario(e.target.value)}>
          {scenarios.map((x) => (
            <option key={x.id} value={x.id}>
              {x.difficulty}｜{x.title}
            </option>
          ))}
        </select>

        <div className="grid">
          <div>
            <h2>{baseScenario.title}</h2>
            <p>{baseScenario.supportType}・{baseScenario.difficulty}</p>
            <ul>{baseScenario.publicContext.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div>
            <h3>学習目標</h3>
            <ul>{baseScenario.learningObjectives.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="panel aiPanel">
        <div>
          <h2>会話生成モード</h2>
          <p className="small">
            挨拶や単純な生活習慣の質問はJMED-Personasの事実から即答します。
            複数の背景を統合する質問だけローカルAIで自然化します。
          </p>
        </div>

        <div className="aiControls">
          <button
            className={aiStatus === "ready" ? "aiReady" : "secondary"}
            onClick={enableLocalAI}
            disabled={aiStatus === "loading" || aiStatus === "ready"}
          >
            {aiStatus === "loading"
              ? "AIを準備中…"
              : aiStatus === "ready"
              ? "ローカルAI 使用中"
              : "ローカルAIを有効にする"}
          </button>

          <label className="toggleLabel">
            <input
              type="checkbox"
              checked={readAloud}
              onChange={(e) => {
                setReadAloud(e.target.checked);
                if (!e.target.checked && synthesisSupported) {
                  window.speechSynthesis.cancel();
                }
              }}
            />
            対象者の発言を読み上げる
          </label>
        </div>

        {aiProgress && (
          <div className="aiProgress">
            <p className="small">{aiProgress}</p>
            {aiProgressValue !== null && <progress max="100" value={aiProgressValue} />}
            <p className="tiny">モデル: {getLocalModelId()}</p>
          </div>
        )}
      </section>

      <section className="workspace">
        <div className="panel conversationPanel">
          <div className="head">
            <h2>会話</h2>
            <button
              className="secondary"
              onClick={() => resetConversation(baseScenario)}
              disabled={!started}
            >
              最初から
            </button>
          </div>

          {personaStatus === "loading" ? (
            <div className="empty">
              <p>JMED-Personasから対象者を準備しています…</p>
            </div>
          ) : !started ? (
            <div className="empty">
              <p>対象者を迎える場面から始まります。</p>
              <p className="small">
                開始時にJMED-Personasの実レコードから40〜74歳の対象者背景を取得します。
              </p>
              <button onClick={() => void loadPersonaAndStart(baseScenario)}>
                トレーニング開始
              </button>
            </div>
          ) : (
            <>
              <div className="scenarioCue">
                <span>場面</span>
                <p>対象者が着席しました。あなたから会話を始めてください。</p>
              </div>

              {personaMessage && <p className="personaSource">{personaMessage}</p>}

              <div className="messages scrollableMessages" ref={messageScrollRef}>
                {messages.length === 0 && (
                  <p className="conversationHint">
                    普段の特定保健指導と同じように、まず挨拶から始めてください。
                  </p>
                )}

                {messages.map((x, i) => (
                  <div key={i} className={"msg " + x.role}>
                    <small>{x.role === "phn" ? "保健師" : "対象者"}</small>
                    <p>{x.text}</p>
                    {x.role === "client" && synthesisSupported && (
                      <button
                        className="speakAgain"
                        type="button"
                        onClick={() => speakClient(x.text)}
                        title="この発言をもう一度読み上げる"
                      >
                        🔊
                      </button>
                    )}
                  </div>
                ))}

                {generating && (
                  <div className="msg client pending">
                    <small>対象者</small>
                    <p>返答を考えています…</p>
                  </div>
                )}
              </div>

              {!finished && (
                <>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="対象者に話しかけてください"
                    disabled={generating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !generating) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />

                  <div className="voiceRow">
                    <button
                      type="button"
                      className={listening ? "voice active" : "voice secondary"}
                      onClick={toggleSpeech}
                      aria-pressed={listening}
                      disabled={generating}
                    >
                      {listening ? "■ 音声入力を停止" : "🎙 音声で入力"}
                    </button>
                    <span className="small">
                      {speechSupported
                        ? "日本語音声をテキスト化します。"
                        : "このブラウザは音声入力に未対応です。"}
                    </span>
                  </div>

                  {speechStatus && (
                    <p className="speechStatus" role="status">{speechStatus}</p>
                  )}

                  <div className="actions">
                    <button onClick={() => void send()} disabled={generating}>
                      {generating ? "返答待ち…" : "送信"}
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        setFinished(true);
                        if (synthesisSupported) window.speechSynthesis.cancel();
                      }}
                    >
                      面接を終了して振り返る
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <aside className="panel">
          <h2>トレーニング中の状態</h2>
          <p className="small">教育用の内部モデルであり心理尺度ではありません。</p>

          {numericStateKeys.map((key) => (
            <div className="metric" key={key}>
              <div><span>{names[key]}</span><span>{state[key]}</span></div>
              <progress max="100" value={state[key]} />
            </div>
          ))}

          <div className="decisionStatus">
            <span>意思決定状態</span>
            <strong>{decisionLabels[state.decisionStatus]}</strong>
          </div>

          <h3>対象者背景</h3>
          <p>{scenario.persona.age}歳・{scenario.persona.sex}／{scenario.persona.occupation}</p>
          {scenario.persona.prefecture && <p>{scenario.persona.prefecture}／{scenario.persona.education}</p>}
          <p>{scenario.persona.exercise}／{scenario.persona.diet}</p>
          {scenario.persona.source === "JMED-Personas" && (
            <p className="sourceBadge">JMED-Personas 実レコード</p>
          )}
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
        対象者背景: JMED-Personas-100k (CC BY 4.0, sociocom/NAIST)。
        参考設計: 厚生労働省「標準的な健診・保健指導プログラム（令和6年度版）」。
      </footer>
    </main>
  );
}
