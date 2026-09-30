import type {
  PersonaDetailDimension,
  PersonaDetailDomain,
} from "./personaMemory";

export type DetailSubjectRule = {
  domain: PersonaDetailDomain;
  key: string;
  label: string;
  patterns: RegExp[];
};

export const detailSubjectRules: DetailSubjectRule[] = [
  { domain: "exercise", key: "walking", label: "歩行・ウォーキング", patterns: [/歩く|歩行|ウォーキング|散歩/] },
  { domain: "exercise", key: "aerobic", label: "有酸素運動", patterns: [/ジョギング|ランニング|自転車|サイクリング|水泳|有酸素/] },
  { domain: "exercise", key: "strength", label: "筋力トレーニング", patterns: [/筋トレ|筋力|スクワット|腕立て|トレーニング/] },
  { domain: "exercise", key: "daily_activity", label: "日常身体活動", patterns: [/階段|家事|通勤.*歩|買い物.*歩|日常.*活動/] },
  { domain: "exercise", key: "sedentary", label: "座位時間", patterns: [/座り|座位|デスクワーク|座っている時間/] },

  { domain: "smoking", key: "cigarette", label: "紙巻きたばこ", patterns: [/紙巻|紙たばこ|紙タバコ|シガレット/] },
  { domain: "smoking", key: "heated_tobacco", label: "加熱式たばこ", patterns: [/加熱式|IQOS|アイコス|glo|グロー|Ploom|プルーム/] },
  { domain: "smoking", key: "quit_attempt", label: "禁煙経験", patterns: [/禁煙.*経験|やめたこと|禁煙した|禁煙外来/] },
  { domain: "smoking", key: "craving", label: "喫煙欲求", patterns: [/吸いたく|吸いたい|欲しく|我慢/] },

  { domain: "alcohol", key: "beer", label: "ビール", patterns: [/ビール/] },
  { domain: "alcohol", key: "wine", label: "ワイン/", patterns: [/ワイン/] },
  { domain: "alcohol", key: "sake", label: "日本酒", patterns: [/日本酒/] },
  { domain: "alcohol", key: "shochu", label: "焼酎", patterns: [/焼酎/] },
  { domain: "alcohol", key: "highball", label: "ハイボール・蒸留酒", patterns: [/ハイボール|ウイスキー/] },
  { domain: "alcohol", key: "social_drinking", label: "飲酒場面", patterns: [/飲み会|会食|付き合い|晩酌/] },

  { domain: "sleep", key: "bedtime", label: "就寝時刻", patterns: [/寝る時間|就寝.*時間|何時.*寝/] },
  { domain: "sleep", key: "wakeup", label: "起床時刻", patterns: [/起きる時間|起床.*時間|何時.*起き/] },
  { domain: "sleep", key: "quality", label: "睡眠の質", patterns: [/睡眠の質|ぐっすり|熟睡|眠りが浅|途中で起き|中途覚醒/] },
  { domain: "sleep", key: "onset", label: "寝つき", patterns: [/寝つき|寝付き|入眠/] },
  { domain: "sleep", key: "daytime_sleepiness", label: "日中の眠気", patterns: [/日中.*眠|昼間.*眠|眠気/] },

  { domain: "work", key: "schedule", label: "勤務時間", patterns: [/勤務時間|始業|終業|何時.*仕事|仕事.*何時/] },
  { domain: "work", key: "overtime", label: "残業", patterns: [/残業/] },
  { domain: "work", key: "shift", label: "交代勤務・夜勤", patterns: [/夜勤|交代勤務|シフト/] },
  { domain: "work", key: "commute", label: "通勤", patterns: [/通勤/] },
  { domain: "work", key: "break", label: "休憩", patterns: [/休憩|昼休み/] },

  { domain: "checkup", key: "weight", label: "体重", patterns: [/体重/] },
  { domain: "checkup", key: "bmi", label: "BMI", patterns: [/BMI|肥満度/] },
  { domain: "checkup", key: "waist", label: "腹囲", patterns: [/腹囲|ウエスト/] },
  { domain: "checkup", key: "blood_pressure", label: "血圧", patterns: [/血圧/] },
  { domain: "checkup", key: "glucose", label: "血糖", patterns: [/血糖|空腹時血糖/] },
  { domain: "checkup", key: "hba1c", label: "HbA1c", patterns: [/HbA1c|ヘモグロビンA1c/] },
  { domain: "checkup", key: "lipids", label: "脂質", patterns: [/LDL|HDL|中性脂肪|トリグリセライド|コレステロール/] },
  { domain: "checkup", key: "liver", label: "肝機能", patterns: [/AST|ALT|γ.?GTP|肝機能/] },

  { domain: "medical", key: "diagnosis", label: "診断・既往歴", patterns: [/診断|既往|持病|病気.*指摘/] },
  { domain: "medical", key: "symptom", label: "症状・体調", patterns: [/症状|体調|痛み|息切れ|めまい|だる|倦怠/] },
  { domain: "medical", key: "family_history", label: "家族歴", patterns: [/家族歴|家族.*病気|親.*病気/] },
  { domain: "medical", key: "treatment", label: "治療", patterns: [/治療|療養/] },

  { domain: "medication", key: "adherence", label: "服薬状況", patterns: [/飲み忘れ|服薬.*管理|アドヒアランス|きちんと.*薬/] },
  { domain: "medication", key: "timing", label: "服薬時刻", patterns: [/薬.*いつ|薬.*何時|服薬.*時間/] },
  { domain: "medication", key: "concern", label: "服薬への不安", patterns: [/薬.*不安|薬.*心配|副作用/] },

  { domain: "family", key: "household", label: "同居状況", patterns: [/同居|独居|一人暮らし|誰と.*暮ら/] },
  { domain: "family", key: "keyperson", label: "キーパーソン", patterns: [/キーパーソン|一番.*相談|誰に.*相談/] },
  { domain: "family", key: "caregiving", label: "家族介護", patterns: [/介護|世話.*家族/] },

  { domain: "social", key: "participation", label: "社会参加", patterns: [/地域活動|社会参加|サークル|自治会|ボランティア/] },
  { domain: "social", key: "isolation", label: "孤立・交流", patterns: [/孤立|交流|人付き合い|友人|友達|近所/] },

  { domain: "finance", key: "food_cost", label: "食費", patterns: [/食費|食事.*費用/] },
  { domain: "finance", key: "healthcare_cost", label: "医療費", patterns: [/医療費|受診.*費用|薬代/] },

  { domain: "healthcare", key: "usual_care", label: "かかりつけ医", patterns: [/かかりつけ/] },
  { domain: "healthcare", key: "transport", label: "通院手段", patterns: [/通院手段|どうやって.*病院|交通手段/] },
  { domain: "healthcare", key: "access", label: "医療アクセス", patterns: [/通院.*難|受診.*難|医療アクセス|病院.*遠/] },

  { domain: "values", key: "hobby", label: "趣味・楽しみ", patterns: [/趣味|楽しみ|好きなこと/] },
  { domain: "values", key: "priority", label: "生活上の優先事項", patterns: [/大切にして|優先|一番大事/] },

  { domain: "stress", key: "work", label: "仕事のストレス", patterns: [/仕事.*ストレス|職場.*ストレス/] },
  { domain: "stress", key: "family", label: "家庭のストレス", patterns: [/家族.*ストレス|家庭.*ストレス/] },
  { domain: "stress", key: "coping", label: "ストレス対処", patterns: [/ストレス.*解消|気分転換|対処.*ストレス/] },

  { domain: "motivation", key: "importance", label: "行動変容の重要度", patterns: [/重要度|どれくらい.*大切|どのくらい.*大切/] },
  { domain: "motivation", key: "confidence", label: "行動変容への自信", patterns: [/自信|できそう|続けられそう/] },
  { domain: "motivation", key: "readiness", label: "行動変容の準備性", patterns: [/準備|今すぐ|いつから|始める気|取り組む気/] },
  { domain: "motivation", key: "barrier", label: "行動変容の障壁", patterns: [/難しい理由|難しい点|障壁|ネック|続かない理由/] },
  { domain: "motivation", key: "goal", label: "本人の目標", patterns: [/目標|どうしたい|変えたい|取り組みたい|やってみたい/] },
  { domain: "motivation", key: "past_attempt", label: "過去の取り組み", patterns: [/以前.*取り組|過去.*取り組|試したこと|やったこと|続いたこと/] },
  { domain: "motivation", key: "benefit", label: "変えるメリット", patterns: [/良いこと|メリット|変えたら.*良|改善したら.*良/] },
  { domain: "motivation", key: "disadvantage", label: "変えるデメリット", patterns: [/困ること|デメリット|変えると.*困|嫌なこと/] },
];

export function detectDetailSubject(
  domain: PersonaDetailDomain,
  text: string
): DetailSubjectRule | undefined {
  return detailSubjectRules.find(
    (rule) =>
      rule.domain === domain &&
      rule.patterns.some((pattern) => pattern.test(text))
  );
}

export function buildDomainDetailKey(
  domain: PersonaDetailDomain,
  fallbackBaseKey: string,
  subject: DetailSubjectRule | undefined,
  dimension: PersonaDetailDimension
): string {
  if (subject) return `${domain}.${subject.key}.${dimension}`;
  return `${fallbackBaseKey}.${dimension}`;
}

export const syntheticDetailDomains = new Set<PersonaDetailDomain>([
  "diet",
  "exercise",
  "smoking",
  "alcohol",
  "sleep",
  "work",
  "family",
  "social",
  "finance",
  "healthcare",
  "values",
  "stress",
  "motivation",
]);

export const factLockedDomains = new Set<PersonaDetailDomain>([
  "checkup",
  "medical",
  "medication",
]);
