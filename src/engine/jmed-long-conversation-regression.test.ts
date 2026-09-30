import { describe, expect, it } from "vitest";
import { scenarios } from "../data/scenarios";
import type { ConversationState, Persona, Scenario } from "../domain/types";
import { analyzeTurn } from "./analyze";
import {
  detectPersonaDetailRequest,
  generatePersonaConsistentFallbackDetail,
  isPersonaDetailAnswerValid,
  personaEvidenceForDetail,
  type PersonaDetailRequest,
  type PersonaSessionMemory,
} from "./personaMemory";
import { updateState, updateStateFromClientReaction } from "./state";

/**
 * Long-session regression fixtures derived from actual synthetic records in
 * JMED-Personas-100k (CC BY 4.0; NAIST Social Computing Lab / NTT DOCOMO).
 * Synthetic names and address-like fields are intentionally omitted.
 */
type LongSessionProfile = {
  label: string;
  persona: Persona;
  initialState: ConversationState;
  expected: {
    smoker: boolean;
    alcoholNone?: boolean;
    highExercise?: boolean;
    breakfastSkipping?: boolean;
    lowConcern?: boolean;
    lowLiteracy?: boolean;
    repeatedGuidance?: boolean;
  };
};

function baseState(overrides: Partial<ConversationState> = {}): ConversationState {
  return {
    ...scenarios[0].initialState,
    trust: 48,
    readiness: 48,
    resistance: 30,
    selfEfficacy: 45,
    disclosure: 45,
    concern: 50,
    importance: 52,
    confidence: 45,
    structuralBarrier: 35,
    socialSupport: 50,
    timeConstraint: 45,
    financialConstraint: 25,
    decisionStatus: "ambivalent",
    ...overrides,
  };
}

function persona(
  sourceId: string,
  fields: Omit<Persona, "id" | "source" | "sourceId">
): Persona {
  return {
    id: `jmed-long-${sourceId}`,
    source: "JMED-Personas",
    sourceId,
    ...fields,
  };
}

const profiles: LongSessionProfile[] = [
  {
    label: "repeated-guidance-current-smoker",
    persona: persona("19bcbc6b992f405e828bec4a7f2eb709", {
      age: 47,
      sex: "男性",
      occupation: "ドラッグストア販売員",
      healthLiteracy: "中",
      economicConstraint: "薬代の負担感はあるが、生活費に大きな支障はない",
      household: "配偶者と同居",
      familyRelationship: "配偶者が主なサポートで、服薬管理や通院の同行を行う。",
      smoking: "現在喫煙",
      alcohol: "機会飲酒",
      exercise: "少ない",
      diet: "朝食は家庭で食べることが多い。昼食は家庭で食べることが多い、夕食は家庭で食べることが多い。主食はパンや麺類になる日も多い。たんぱく源は肉料理が多めである。野菜料理は少なめで、主食や主菜に偏る日がある。果物は時々食べる。",
      sleep: "やや不良",
      values: "菓子作りと舞台鑑賞を気分転換にしている。",
      representativeUtterance: "最近、血圧が高いと感じて病院に行ってみました。頭痛が続くのが気になっていました。",
      socialParticipation: "地域のドラッグストアで勤務し、菓子作りや舞台鑑賞で交流がある。",
      checkupHistory: "過去5年の健康診断で血圧上昇が認められ、生活指導を受けたが改善は限定的",
      familyHistory: "父親が40代で心筋梗塞、母親が高血圧",
      primaryDiagnosis: "本態性高血圧症",
      pastMedicalHistory: "特記すべき既往歴なし",
      symptoms: "頭痛（時に）と軽度の息切れ",
      height: "175.6 cm",
      weight: "54.6 kg",
      bmi: "17.7 kg/m2",
      vitalSigns: "血圧150/95 mmHg、脈拍78回/分、体温36.8℃、呼吸数16回/分、体重54.6 kg、BMI 17.7 kg/m2",
      bloodTests: "血清クレアチニン正常、LDLコレステロール140 mg/dL、HDLコレステロール40 mg/dL、血糖120 mg/dL（空腹）",
      healthcareUse: "地域の総合病院循環器外来を年1回以上受診",
      medications: "エナラプリル（アンジオテンシン変換酵素阻害薬）10 mg/日",
      medicationAdherence: "時々忘れる",
      healthcareAccess: "自家用車で病院へ約30分で通院。",
    }),
    initialState: baseState({
      readiness: 38,
      resistance: 46,
      importance: 58,
      confidence: 35,
      decisionStatus: "ambivalent",
    }),
    expected: { smoker: true, repeatedGuidance: true },
  },
  {
    label: "low-literacy-economic-constraint-change-ready",
    persona: persona("d02a78e7228641278165af31f6ea29f7", {
      age: 62,
      sex: "男性",
      occupation: "介護支援専門員",
      healthLiteracy: "低",
      economicConstraint: "中等度",
      household: "子と同居",
      familyRelationship: "長男が主なサポート役として服薬管理や生活支援を行う。",
      smoking: "過去喫煙",
      alcohol: "なし",
      exercise: "少ない",
      diet: "朝食は家庭で食べることが多い。昼食は弁当や惣菜などの調理済み食で済ませる日がある、夕食は家庭で食べることが多い。主食は米飯が中心である。たんぱく源には魚料理も入る。野菜料理は少なめで、主食や主菜に偏る日がある。果物はあまり食べない。",
      sleep: "良好",
      values: "読書を気分転換にしている。",
      representativeUtterance: "最近、血糖が上がっていると感じて、もう少し食事を見直したいです。",
      socialParticipation: "地域の読書サークルに参加し、孤立は少ない。",
      checkupHistory: "過去1年の健康診断でBMI 23.5、血圧130/80、脂質異常（LDL高）を指摘された。",
      familyHistory: "父親が70歳で糖尿病、母親が心筋梗塞の既往あり。",
      primaryDiagnosis: "2型糖尿病",
      pastMedicalHistory: "高血圧症（ロサルタン服用中）、脂質異常症",
      symptoms: "倦怠感、頻尿、多飲",
      height: "176.9 cm",
      weight: "73.5 kg",
      bmi: "23.5 kg/m2",
      vitalSigns: "血圧130/80 mmHg、脈拍78回/分、体温36.8℃、SpO2 98%。",
      bloodTests: "HbA1c 8.2%、空腹血糖150 mg/dL、LDL 140 mg/dL、HDL 38 mg/dL、トリグリセリド180 mg/dL、クレアチニン1.0 mg/dL。",
      healthcareUse: "在宅医療チームが主担当",
      medications: "メトホルミン500mg 1日2回、ロサルタン25mg 1日1回、シロスタゾール81mg 1日1回",
      medicationAdherence: "時々忘れる",
      healthcareAccess: "訪問診療が中心で、必要時は家族が車で同行して医療機関へ行く。",
    }),
    initialState: baseState({
      readiness: 66,
      importance: 72,
      confidence: 42,
      financialConstraint: 62,
      socialSupport: 70,
      decisionStatus: "considering",
    }),
    expected: { smoker: false, alcoholNone: true, lowLiteracy: true },
  },
  {
    label: "current-smoker-heavy-alcohol-worker",
    persona: persona("cffa36b24f174090aaa8d44ec7bbdf88", {
      age: 53,
      sex: "男性",
      occupation: "建設作業員",
      healthLiteracy: "中",
      economicConstraint: "特に制約なし",
      household: "配偶者と同居",
      familyRelationship: "配偶者（妻）が主なサポート",
      smoking: "現在喫煙",
      alcohol: "多量",
      exercise: "週1〜2回",
      diet: "朝食は外食になる日がある。昼食は弁当や惣菜などの調理済み食で済ませる日がある、夕食は家庭で食べることが多い。主食は米飯と麺類が混在している。卵や乳製品でたんぱく質を補うことがある。野菜は平均的な量だが、毎食十分とは限らない。果物は時々食べる。",
      sleep: "良好",
      values: "ゲームを気分転換にしている。",
      representativeUtterance: "最近、血糖が気になるんです。",
      socialParticipation: "オンラインゲームで友人と交流し、社会的孤立は低い",
      checkupHistory: "3年前に糖尿病診断、以降定期外来受診",
      familyHistory: "父が2型糖尿病、母が高血圧",
      primaryDiagnosis: "2型糖尿病",
      pastMedicalHistory: "高血圧症・脂質異常症",
      symptoms: "多飲、多尿、倦怠感",
      height: "175.9 cm",
      weight: "79.9 kg",
      bmi: "25.8 kg/m2",
      vitalSigns: "血圧130/80 mmHg、脈拍78回/分、体温36.8℃",
      bloodTests: "HbA1c 7.5%、空腹血糖 150 mg/dL、LDLコレステロール 130 mg/dL、TSH 正常",
      healthcareUse: "かかりつけ医あり、年1回の定期健診を受診",
      medications: "メトホルミン500mg 1日2回、アトルバスタチン10mg 1日1回、カンデサルタン50mg 1日1回",
      medicationAdherence: "良好",
      healthcareAccess: "自家用車で通院、週1回外来受診",
    }),
    initialState: baseState({
      readiness: 44,
      resistance: 38,
      importance: 60,
      confidence: 44,
      timeConstraint: 62,
    }),
    expected: { smoker: true },
  },
  {
    label: "living-alone-low-activity-community-support",
    persona: persona("39d85c7689d849e188f57b82a637894e", {
      age: 66,
      sex: "女性",
      occupation: "家事専業",
      healthLiteracy: "中",
      economicConstraint: "特に大きな制約なし",
      household: "独居",
      familyRelationship: "近隣の友人が緊急時のサポートを提供",
      smoking: "なし",
      alcohol: "機会飲酒",
      exercise: "少ない",
      diet: "朝食は抜く日がある。昼食は家庭で食べることが多い、夕食は家庭で食べることが多い。主食はパンや麺類になる日も多い。たんぱく源として豆腐や納豆などの大豆製品を使う。野菜料理は比較的多いが、日によって差がある。果物を日常的に食べることが多い。",
      sleep: "良好",
      values: "手芸を気分転換にしている。",
      representativeUtterance: "膝が痛くなると、階段を上がるのが怖くなります。",
      socialParticipation: "地域の手芸サークルに月1回参加し、孤立感は低い",
      checkupHistory: "3年前の健康診断で血圧が指摘され、現在は薬で管理中。",
      familyHistory: "特記すべき家族歴なし。",
      primaryDiagnosis: "変形性膝関節症",
      pastMedicalHistory: "高血圧症（薬物治療中）",
      symptoms: "膝関節の疼痛、腫脹、可動域制限、夜間の軽度の違和感",
      height: "149.9 cm",
      weight: "55.8 kg",
      bmi: "24.8 kg/m2",
      vitalSigns: "血圧130/78 mmHg、脈拍78回/分、体温36.8℃、SpO2 98%",
      bloodTests: "CRP正常、血糖正常、腎機能正常、肝機能正常",
      healthcareUse: "かかりつけ医の内科医があり、定期的に外来受診",
      medications: "アセトアミノフェン500mgを1日3回、ロキソプロフェン20mgを必要時に1日1回",
      medicationAdherence: "良好",
      healthcareAccess: "徒歩と公共交通機関で通院、時折タクシー利用",
    }),
    initialState: baseState({
      readiness: 48,
      socialSupport: 48,
      structuralBarrier: 52,
      confidence: 40,
    }),
    expected: { smoker: false, breakfastSkipping: true },
  },
  {
    label: "explicit-change-intent-heavy-alcohol",
    persona: persona("25ee8cc783884751a09d34e7350a6abe", {
      age: 44,
      sex: "男性",
      occupation: "理美容師",
      healthLiteracy: "中",
      economicConstraint: "特に制約なし",
      household: "その他",
      familyRelationship: "妻が主な生活支援者で、食事や通院のサポートを行う",
      smoking: "なし",
      alcohol: "多量",
      exercise: "少ない",
      diet: "朝食は家庭で食べることが多い。昼食は外食になる日がある、夕食は家庭で食べることが多い。主食は米飯が中心である。卵や乳製品でたんぱく質を補うことがある。野菜料理は比較的多いが、日によって差がある。果物はあまり食べない。",
      sleep: "やや不良",
      values: "映画・動画鑑賞を気分転換にしている。",
      representativeUtterance: "最近、体重が増えてきたのが気になって、血圧も高めなので何か改善したいです。",
      socialParticipation: "地域の映画サークルに月1回参加しているが、仕事のシフトで参加頻度は限られる",
      checkupHistory: "過去5年にわたり年1回の健康診断を受診し、BMIは徐々に上昇傾向",
      familyHistory: "父親が本態性高血圧、母親が2型糖尿病",
      primaryDiagnosis: "BMI 24.7",
      pastMedicalHistory: "特記すべき既往歴なし",
      symptoms: "軽度の息切れ、疲労感、体重増加感",
      height: "172.0 cm",
      weight: "73.0 kg",
      bmi: "24.7 kg/m2",
      vitalSigns: "血圧148/92 mmHg、脈拍78回/分、体温36.7℃、呼吸数16回/分",
      bloodTests: "空腹時血糖108 mg/dL、HbA1c 5.9%、LDLコレステロール140 mg/dL、中性脂肪180 mg/dL、ALT 28 U/L",
      healthcareUse: "定期的に内科を受診し、年1回の健康診断を受けている",
      medications: "アンジオテンシン受容体拮抗薬（1日1回）",
      medicationAdherence: "良好",
      healthcareAccess: "自家用車で近隣の総合病院内科外来へ通院",
    }),
    initialState: baseState({
      readiness: 70,
      importance: 76,
      confidence: 55,
      decisionStatus: "considering",
    }),
    expected: { smoker: false },
  },
  {
    label: "high-exercise-but-smoking-and-heavy-alcohol",
    persona: persona("d6a6e934f93e430992ac9136682bd0f3", {
      age: 68,
      sex: "男性",
      occupation: "倉庫作業員",
      healthLiteracy: "中",
      economicConstraint: "特になし",
      household: "親と同居",
      familyRelationship: "同居の親が生活支援を行い、受診時の付き添いが可能",
      smoking: "現在喫煙",
      alcohol: "多量",
      exercise: "週3回以上",
      diet: "朝食は家庭で食べることが多い。昼食は外食になる日がある、夕食は家庭で食べることが多い。主食はパンや麺類になる日も多い。たんぱく源として豆腐や納豆などの大豆製品を使う。野菜は平均的な量だが、毎食十分とは限らない。果物はあまり食べない。",
      sleep: "良好",
      values: "映画・動画鑑賞を気分転換にしている。",
      representativeUtterance: "肩の痛みが続いていて、映画を見るときに首が動かしにくいんです。",
      socialParticipation: "週3回のジム通いと動画鑑賞で社会的交流はあるが、外出は限定的",
      checkupHistory: "過去1年に特記すべき所見なし",
      familyHistory: "特記すべき家族歴なし。",
      primaryDiagnosis: "肩関節周囲炎",
      pastMedicalHistory: "高血圧（薬物治療中）",
      symptoms: "肩部疼痛、前方挙上時の制限、夜間疼痛",
      height: "175.0 cm",
      weight: "83.6 kg",
      bmi: "27.3 kg/m2",
      vitalSigns: "血圧130/85 mmHg、脈拍78回/分、体温36.8℃、SpO2 98%",
      bloodTests: "CRP 0.3 mg/dL、血糖110 mg/dL（空腹）",
      healthcareUse: "定期的に整形外科を受診",
      medications: "ロキソプロフェン錠60mg、1日3回",
      medicationAdherence: "良好",
      healthcareAccess: "自家用車で整形外科へ通院",
    }),
    initialState: baseState({
      readiness: 42,
      importance: 50,
      confidence: 68,
      resistance: 34,
    }),
    expected: { smoker: true, highExercise: true },
  },
  {
    label: "low-concern-routine-checkup",
    persona: persona("8506a84f58f043c2852ad9d4942d078f", {
      age: 72,
      sex: "女性",
      occupation: "退職済み（前職: 農業）",
      healthLiteracy: "中",
      economicConstraint: "特になし",
      household: "子と同居",
      familyRelationship: "子どもが主なサポート役で、通院や生活支援を行う",
      smoking: "なし",
      alcohol: "なし",
      exercise: "少ない",
      diet: "朝食は家庭で食べることが多い。昼食は家庭で食べることが多い、夕食は弁当や惣菜などの調理済み食で済ませる日がある。主食は米飯が中心である。卵や乳製品でたんぱく質を補うことがある。野菜は平均的な量だが、毎食十分とは限らない。果物を日常的に食べることが多い。",
      sleep: "良好",
      values: "映画・動画鑑賞を気分転換にしている。",
      representativeUtterance: "最近は体調に変わりがなく、特に心配することはありません。",
      socialParticipation: "地域のシニアサークルに参加し、交流はある",
      checkupHistory: "過去5年間、年1回の健康診査を受診",
      familyHistory: "父親は70歳で心筋梗塞、母親は糖尿病の既往あり",
      primaryDiagnosis: "健康診査受診",
      pastMedicalHistory: "特になし",
      symptoms: "特に自覚症状なし",
      height: "154.9 cm",
      weight: "42.6 kg",
      bmi: "17.8 kg/m2",
      vitalSigns: "血圧124/78 mmHg、脈拍72回/分、体温36.6℃、体重42.6 kg、BMI 17.8 kg/m2",
      bloodTests: "血糖92 mg/dL、総コレステロール180 mg/dL、HDL55 mg/dL、LDL100 mg/dL、HbA1c 5.4%、貧血なし",
      healthcareUse: "地域の総合診療科医をかかりつけ医として、年1回の定期健康診査を受診",
      medications: "特になし",
      medicationAdherence: "良好",
      healthcareAccess: "自家用車または公共バスで通院",
    }),
    initialState: baseState({
      concern: 22,
      readiness: 25,
      importance: 34,
      confidence: 56,
      resistance: 24,
      decisionStatus: "not_considering",
    }),
    expected: { smoker: false, alcoholNone: true, lowConcern: true },
  },
];

type Turn = {
  q: string;
  domain: string;
  dimension?: string;
};

const longSessionTurns: Turn[] = [
  { q: "運動は普段どのようにしていますか", domain: "exercise", dimension: "items" },
  { q: "週に何回くらいですか", domain: "exercise", dimension: "frequency" },
  { q: "1回何分くらいですか", domain: "exercise", dimension: "duration" },
  { q: "続けにくいのはどんな時ですか", domain: "exercise", dimension: "barrier" },
  { q: "朝食は食べていますか", domain: "diet", dimension: "presence" },
  { q: "昼食はどんなものを食べていますか", domain: "diet", dimension: "items" },
  { q: "その昼食で野菜は食べていますか", domain: "diet", dimension: "presence" },
  { q: "どれくらいの量ですか", domain: "diet", dimension: "amount" },
  { q: "睡眠時間は何時間くらいですか", domain: "sleep", dimension: "duration" },
  { q: "お酒は週に何回くらい飲みますか", domain: "alcohol", dimension: "frequency" },
  { q: "たばこは吸っていますか", domain: "smoking", dimension: "presence" },
  { q: "健康のことは誰に相談できますか", domain: "family", dimension: "support" },
  { q: "健康づくりで費用面で難しいことはありますか", domain: "finance", dimension: "barrier" },
  { q: "病院にはどのような交通手段で通っていますか", domain: "healthcare", dimension: "items" },
  { q: "血圧はどのくらいでしたか", domain: "checkup", dimension: "amount" },
  { q: "生活を変えることはどのくらい重要だと思いますか", domain: "motivation", dimension: "importance" },
  { q: "生活を変える自信はどのくらいありますか", domain: "motivation", dimension: "confidence" },
  { q: "今どのくらい取り組む準備ができていますか", domain: "motivation", dimension: "readiness" },
  { q: "変えるとしたら、難しい点は何ですか", domain: "motivation", dimension: "barrier" },
  { q: "変えたらどんな良いことがありそうですか", domain: "motivation", dimension: "benefit" },
  { q: "逆に変えることで困ることはありますか", domain: "motivation", dimension: "disadvantage" },
  { q: "続けるにはどんな工夫ができそうですか", domain: "motivation", dimension: "strategy" },
  { q: "これからどのような目標にしたいですか", domain: "motivation", dimension: "goal" },
];

function scenarioFor(profile: LongSessionProfile): Scenario {
  return {
    ...scenarios[0],
    id: `long-${profile.label}`,
    title: `長時間会話回帰: ${profile.label}`,
    persona: profile.persona,
    initialState: profile.initialState,
  };
}

function medicalNumbers(text: string): string[] {
  return text.match(/[0-9]+(?:\.[0-9]+)?/g) ?? [];
}

function assertNoRoleReversal(answer: string) {
  expect(answer).not.toMatch(
    /(?:してください|しましょう|おすすめします|受診してください|相談してください|支援します|お手伝いします)/
  );
}

describe("long conversation regression with fixed JMED-Personas synthetic records", () => {
  it.each(profiles)(
    "$label: sustains a 23-turn conversation without losing persona identity",
    (profile) => {
      const scenario = scenarioFor(profile);
      const memory: PersonaSessionMemory = {};
      let previous: PersonaDetailRequest | null = null;
      let state = { ...profile.initialState };
      const answers: string[] = [];
      const requests: PersonaDetailRequest[] = [];

      for (const [index, turn] of longSessionTurns.entries()) {
        const request = detectPersonaDetailRequest(turn.q, previous);
        expect(request, `turn ${index + 1}: ${turn.q}`).not.toBeNull();
        expect(request?.domain, `turn ${index + 1}: ${turn.q}`).toBe(turn.domain);
        if (turn.dimension) {
          expect(request?.dimension, `turn ${index + 1}: ${turn.q}`).toBe(
            turn.dimension
          );
        }

        const analysis = analyzeTurn(turn.q);
        state = updateState(state, analysis);

        const answer = generatePersonaConsistentFallbackDetail(
          scenario,
          request!,
          memory,
          state
        );

        expect(answer.trim().length, `turn ${index + 1}: ${turn.q}`).toBeGreaterThan(2);
        expect(
          isPersonaDetailAnswerValid(request!, answer),
          `turn ${index + 1}: ${turn.q} -> ${answer}`
        ).toBe(true);
        assertNoRoleReversal(answer);

        if (request!.domain === "checkup") {
          const evidence = personaEvidenceForDetail(scenario, request!);
          for (const number of medicalNumbers(answer)) {
            expect(
              `${evidence} ${turn.q}`,
              `unrecorded checkup number ${number}: ${answer}`
            ).toContain(number);
          }
        }

        memory[request!.key] = answer;
        answers.push(answer);
        requests.push(request!);
        previous = request;

        state = updateStateFromClientReaction(state, analysis, answer);
        for (const value of [
          state.trust,
          state.readiness,
          state.resistance,
          state.selfEfficacy,
          state.disclosure,
          state.concern,
          state.importance,
          state.confidence,
          state.structuralBarrier,
          state.socialSupport,
          state.timeConstraint,
          state.financialConstraint,
        ]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
        }
      }

      expect(requests).toHaveLength(23);
      expect(answers).toHaveLength(23);
      expect(new Set(answers).size).toBeGreaterThanOrEqual(14);
      expect(profile.persona.source).toBe("JMED-Personas");
      expect(profile.persona.sourceId).toMatch(/^[0-9a-f]{32}$/);

      const lunchRequest = requests.find(
        (r) =>
          r.domain === "diet" &&
          r.meal === "lunch" &&
          r.dimension === "items"
      );
      expect(lunchRequest).toBeDefined();
      const firstLunch = memory[lunchRequest!.key];
      const repeatLunch = generatePersonaConsistentFallbackDetail(
        scenario,
        lunchRequest!,
        memory,
        state
      );
      expect(repeatLunch).toBe(firstLunch);

      const smokingRequest = requests.find((r) => r.domain === "smoking")!;
      const smokingAnswer = memory[smokingRequest.key];
      if (profile.expected.smoker) {
        expect(smokingAnswer).toMatch(/吸|喫煙/);
        expect(smokingAnswer).not.toMatch(/吸わない|非喫煙|1日0本/);
      } else {
        expect(smokingAnswer).toMatch(/なし|吸わない|非喫煙|過去喫煙|今は/);
      }

      const alcoholRequest = requests.find((r) => r.domain === "alcohol")!;
      const alcoholAnswer = memory[alcoholRequest.key];
      if (profile.expected.alcoholNone) {
        expect(alcoholAnswer).toMatch(/飲まない|なし|0回/);
      }

      if (profile.expected.highExercise) {
        const exerciseFrequency = requests.find(
          (r) => r.domain === "exercise" && r.dimension === "frequency"
        )!;
        expect(memory[exerciseFrequency.key]).toMatch(/週3|3回以上|週に3/);
      }

      if (profile.expected.breakfastSkipping) {
        const breakfast = requests.find(
          (r) =>
            r.domain === "diet" &&
            r.meal === "breakfast" &&
            r.dimension === "presence"
        );
        expect(breakfast).toBeDefined();
        expect(memory[breakfast!.key]).toMatch(/抜く|食べない|毎日では|日がある/);
      }

      if (profile.expected.lowConcern) {
        expect(profile.persona.representativeUtterance).toContain("特に心配することはありません");
        expect(profile.initialState.decisionStatus).toBe("not_considering");
      }

      if (profile.expected.lowLiteracy) {
        expect(profile.persona.healthLiteracy).toBe("低");
      }

      if (profile.expected.repeatedGuidance) {
        expect(profile.persona.checkupHistory).toContain("生活指導");
        expect(profile.persona.checkupHistory).toContain("改善は限定的");
      }
    }
  );

  it.each(profiles)(
    "$label: keeps fact-locked medical answers grounded after a long lifestyle discussion",
    (profile) => {
      const scenario = scenarioFor(profile);
      const memory: PersonaSessionMemory = {};
      let previous: PersonaDetailRequest | null = null;

      for (const turn of longSessionTurns.slice(0, 14)) {
        const request = detectPersonaDetailRequest(turn.q, previous);
        expect(request).not.toBeNull();
        const answer = generatePersonaConsistentFallbackDetail(
          scenario,
          request!,
          memory,
          profile.initialState
        );
        memory[request!.key] = answer;
        previous = request;
      }

      const medicalQuestions = [
        "血圧はどのくらいでしたか",
        "体重はどのくらいでしたか",
        "BMIはどのくらいでしたか",
      ];

      for (const q of medicalQuestions) {
        const request = detectPersonaDetailRequest(q, previous)!;
        expect(request.domain).toBe("checkup");
        const evidence = personaEvidenceForDetail(scenario, request);
        const answer = generatePersonaConsistentFallbackDetail(
          scenario,
          request,
          memory,
          profile.initialState
        );

        expect(isPersonaDetailAnswerValid(request, answer), `${q} -> ${answer}`).toBe(true);
        for (const number of medicalNumbers(answer)) {
          expect(`${evidence} ${q}`).toContain(number);
        }
        previous = request;
      }
    }
  );
});
