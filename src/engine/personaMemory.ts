import { ConversationState, Persona, Scenario } from "../domain/types";
import {
  buildDomainDetailKey,
  detectDetailSubject,
  factLockedDomains,
  syntheticDetailDomains,
} from "./detailSchema";

export type PersonaSessionMemory = Record<string, string>;

export type PersonaDetailDimension =
  | "presence"
  | "items"
  | "frequency"
  | "amount"
  | "time"
  | "duration"
  | "intensity"
  | "reason"
  | "barrier"
  | "trigger"
  | "context"
  | "history"
  | "support"
  | "preference"
  | "change"
  | "confidence"
  | "importance"
  | "goal"
  | "readiness"
  | "benefit"
  | "disadvantage"
  | "understanding"
  | "strategy"
  | "detail";

export type PersonaDetailDomain =
  | "diet"
  | "exercise"
  | "smoking"
  | "alcohol"
  | "sleep"
  | "work"
  | "checkup"
  | "medical"
  | "medication"
  | "family"
  | "social"
  | "finance"
  | "healthcare"
  | "values"
  | "stress"
  | "motivation";

export type PersonaMealContext = "breakfast" | "lunch" | "dinner";

export type PersonaFoodContext =
  | "vegetables"
  | "fruit"
  | "meat"
  | "fish"
  | "noodles"
  | "bread"
  | "rice"
  | "staple"
  | "snack"
  | "eatingout"
  | "protein"
  | "sweets"
  | "beverage";

export type PersonaDetailRequest = {
  key: string;
  label: string;
  domain: PersonaDetailDomain;
  subject?: string;
  dimension: PersonaDetailDimension;
  meal?: PersonaMealContext;
  food?: PersonaFoodContext;
  isCorrection?: boolean;
  queryText?: string;
};

type TopicDefinition = {
  domain: PersonaDetailDomain;
  baseKey: string;
  label: string;
  patterns: RegExp[];
};

const compact = (text: string) => text.replace(/\s+/g, "");

function correctionFocus(text: string): string {
  const compacted = compact(text);
  const markers = [
    "ではなく",
    "じゃなく",
    "そうではなく",
    "聞きたいのは",
    "聞いているのは",
    "質問しているのは",
  ];
  let focus = compacted;
  for (const marker of markers) {
    const index = focus.lastIndexOf(marker);
    if (index >= 0) focus = focus.slice(index + marker.length);
  }
  return focus;
}

function detailDimension(text: string): PersonaDetailDimension {
  const t = compact(text);

  if (/困ること|デメリット|変えると.*困|変えることで.*困|嫌なこと/.test(t)) {
    return "disadvantage";
  }
  if (/良いこと|メリット|変えたら.*良|改善したら.*良/.test(t)) {
    return "benefit";
  }

  if (/(吸いたく|飲みたく).*(どんな時|いつ|時に)|(?:どんな時|いつ).*(吸いたく|飲みたく)/.test(t)) {
    return "trigger";
  }

  if (
    /難しい理由|難しいこと|難しい点|難しい|できない理由|続かない理由|妨げ|障壁|ネック|困って|困る|難しさ|負担にな|できない|続けにく|しにく|行きにく|受けにく|遠くて/.test(
      t
    )
  ) {
    return "barrier";
  }
  if (/どうすれば|どうしたら|工夫|方法.*続|やり方.*続/.test(t)) return "strategy";
  if (/自信|できそう|できると思|続けられそう/.test(t)) return "confidence";
  if (
    /どのくらい.*(?:大切|重要)|どれくらい.*(?:大切|重要)|(?:大切|重要).*(?:程度|思いますか|感じますか)|優先度|重要度/.test(
      t
    )
  ) {
    return "importance";
  }
  if (/理解|分かりましたか|わかりましたか|どう受け止め|結果.*どう思/.test(t)) return "understanding";
  if (/準備|今すぐ|いつから|始める気|取り組む気|変える気/.test(t)) return "readiness";
  if (/良いこと|メリット|変えたら.*良|改善したら.*良/.test(t)) return "benefit";
  if (/困ること|デメリット|変えると.*困|嫌なこと/.test(t)) return "disadvantage";
  if (/目標|どうしたい|変えたい|取り組みたい|やってみたい/.test(t)) return "goal";
  if (/きっかけ|始めた理由|吸う理由|飲む理由/.test(t)) return "trigger";
  if (/なぜ|どうして|理由|何があって|どういうわけ/.test(t)) return "reason";

  if (
    /どれくらいの量|どのくらいの量|どれくらいでした|どのくらいでした|量は|量ですか|何皿|何個|何杯|何本|何グラム|何g|何ml|何mL|何合|何人前/.test(
      t
    )
  ) {
    return "amount";
  }
  if (/何回|頻度|週に|1週間|一週間|毎日|何日|何度|月に|年に/.test(t)) {
    return "frequency";
  }
  if (/何分|何時間|どのくらいの時間|どれくらいの時間|どのくらい.*時間|どれくらい.*時間|どのくらい続|どれくらい続|期間/.test(t)) {
    return "duration";
  }
  if (/何時|時間帯|いつ|何時頃|何時ごろ|何時ぐらい|何時くらい|何曜日/.test(t)) {
    return "time";
  }
  if (/強度|きつさ|どの程度きつ|息が上が|汗をか|速さ|ペース/.test(t)) {
    return "intensity";
  }
  if (/以前|過去|これまで|前にも|昔|やめたこと|試したこと|受けたこと|続いたこと/.test(t)) {
    return "history";
  }
  if (/誰か|家族.*支|支えて|手伝って|協力|相談でき|相談相手|サポート|頼れ/.test(t)) {
    return "support";
  }
  if (/どこで|場所|職場で|家で|自宅で|外で|一人で|誰と/.test(t)) {
    return "context";
  }
  if (/好み|好き|嫌い|選ぶ|選びたい|どちらが/.test(t)) {
    return "preference";
  }
  if (/変わった|変化|以前と比べ|増えた|減った/.test(t)) return "change";
  if (
    /どんな|どのような|どのように|どうやって|何を|何ですか|種類|具体的|詳しく|詳しい|内容|方法|やり方|メニュー|献立|中身/.test(
      t
    )
  ) {
    return "items";
  }
  if (
    /(食べていますか|食べますか|摂っていますか|取っていますか|していますか|ありますか|いますか|飲みますか|吸いますか|眠れますか|通っていますか|受けていますか|使っていますか|頼れますか)[？?]?$/.test(
      t
    )
  ) {
    return "presence";
  }

  return "detail";
}

function detectMeal(text: string): PersonaMealContext | undefined {
  const t = compact(text);
  if (/朝食|朝ごはん|朝ご飯/.test(t)) return "breakfast";
  if (/昼食|昼ごはん|昼ご飯|お昼ごはん|お昼ご飯|ランチ/.test(t)) return "lunch";
  if (/夕食|夕ごはん|夕ご飯|夕飯|晩ごはん|晩ご飯/.test(t)) return "dinner";
  return undefined;
}

function detectFood(text: string): PersonaFoodContext | undefined {
  const t = compact(text);
  if (/野菜|サラダ/.test(t)) return "vegetables";
  if (/果物|フルーツ/.test(t)) return "fruit";
  if (/うどん|そば|蕎麦|ラーメン|パスタ|スパゲッティ|焼きそば|そうめん|素麺|麺類|麺/.test(t)) {
    return "noodles";
  }
  if (/肉|肉料理/.test(t)) return "meat";
  if (/魚|魚料理/.test(t)) return "fish";
  if (/パン|食パン|トースト/.test(t)) return "bread";
  if (/ご飯|米飯|白米|玄米|米/.test(t)) return "rice";
  if (/主食/.test(t)) return "staple";
  if (/間食|お菓子|菓子|おやつ/.test(t)) return "snack";
  if (/外食|惣菜|弁当/.test(t)) return "eatingout";
  if (/たんぱく|タンパク|蛋白/.test(t)) return "protein";
  if (/甘いもの|スイーツ|ケーキ|チョコ/.test(t)) return "sweets";
  if (/飲み物|ジュース|清涼飲料|コーヒー|お茶/.test(t)) return "beverage";
  return undefined;
}

const mealLabels: Record<PersonaMealContext, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
};

const foodLabels: Record<PersonaFoodContext, string> = {
  vegetables: "野菜",
  fruit: "果物",
  meat: "肉料理",
  fish: "魚料理",
  noodles: "麺類",
  bread: "パン",
  rice: "ご飯",
  staple: "主食",
  snack: "間食",
  eatingout: "外食・惣菜",
  protein: "たんぱく質",
  sweets: "甘いもの",
  beverage: "飲み物",
};

const topicDefinitions: TopicDefinition[] = [
  {
    domain: "smoking",
    baseKey: "smoking.use",
    label: "喫煙",
    patterns: [/喫煙|たばこ|タバコ|煙草|吸って|吸います|禁煙/],
  },
  {
    domain: "alcohol",
    baseKey: "alcohol.pattern",
    label: "飲酒",
    patterns: [/飲酒|お酒|アルコール|ビール|日本酒|焼酎|ワイン|晩酌|飲み会/],
  },
  {
    domain: "exercise",
    baseKey: "exercise.activity",
    label: "運動・身体活動",
    patterns: [/運動|身体活動|歩く|歩行|ウォーキング|ジョギング|筋トレ|階段|スポーツ|座位|座って|座り/],
  },
  {
    domain: "sleep",
    baseKey: "sleep.pattern",
    label: "睡眠・休養",
    patterns: [/睡眠|寝|眠|就寝|起床|起き|目覚め|休養|昼寝|眠気/],
  },
  {
    domain: "medication",
    baseKey: "medication.use",
    label: "服薬",
    patterns: [/服薬|処方薬|薬を|薬は|薬について|薬が|薬の|飲み忘れ|内服|薬局/],
  },
  {
    domain: "checkup",
    baseKey: "checkup.result",
    label: "健診結果",
    patterns: [/特定健診|健診|検診|健診結果|腹囲|BMI|体重|血圧|血糖|HbA1c|LDL|中性脂肪|コレステロール/],
  },
  {
    domain: "healthcare",
    baseKey: "healthcare.access",
    label: "受診・医療アクセス",
    patterns: [/かかりつけ|通院|受診|病院|医院|クリニック|医療機関|通院手段|受診手段/],
  },
  {
    domain: "medical",
    baseKey: "medical.history",
    label: "健康・既往歴",
    patterns: [/病気|既往|診断|症状|治療|家族歴|持病|健康状態|体調/],
  },
  {
    domain: "work",
    baseKey: "work.pattern",
    label: "仕事・勤務",
    patterns: [/仕事|勤務|職場|残業|夜勤|交代勤務|働|通勤|休憩/],
  },
  {
    domain: "family",
    baseKey: "family.relationship",
    label: "家族・同居状況",
    patterns: [/家族|同居|独居|一人暮らし|暮らし|暮らして|配偶者|夫婦|(?<!工)夫(?:と|が|は|に|の|を|へ|です|、|。|$)|妻|子ども|子供|親|介護|誰に.*相談|相談できる人|相談相手/],
  },
  {
    domain: "social",
    baseKey: "social.participation",
    label: "社会参加・人とのつながり",
    patterns: [/友人|友達|地域活動|社会参加|孤立|人付き合い|交流|近所|コミュニティ/],
  },
  {
    domain: "finance",
    baseKey: "finance.constraint",
    label: "経済的な制約",
    patterns: [/費用|お金|経済|家計|生活費|医療費|食費|金銭/],
  },
  {
    domain: "values",
    baseKey: "values.priority",
    label: "価値観・大切にしていること",
    patterns: [/趣味|楽しみ|大切|生きがい|優先|好きなこと|続けたいこと/],
  },
  {
    domain: "stress",
    baseKey: "stress.context",
    label: "ストレス・心理的負担",
    patterns: [/ストレス|悩み|精神的|気持ち|負担|疲れ|疲労|気分|心配|不安/],
  },
  {
    domain: "motivation",
    baseKey: "motivation.change",
    label: "行動変容への気持ち",
    patterns: [/やる気|意欲|変えたい|改善したい|取り組|自信|できそう|続けられ|目標|重要|準備|変えること|変えたら|メリット|デメリット/],
  },
];

function isDietCue(text: string): boolean {
  return /食事|食生活|食べ|朝食|昼食|夕食|間食|野菜|果物|主食|外食|惣菜|弁当|飲み物|甘いもの/.test(
    compact(text)
  );
}

function buildDietKey(
  meal: PersonaMealContext | undefined,
  food: PersonaFoodContext | undefined,
  dimension: PersonaDetailDimension
): string {
  const parts = ["diet"];
  if (meal) parts.push(meal);
  if (food) parts.push(food);
  parts.push(dimension);
  return parts.join(".");
}

function buildDietLabel(
  meal: PersonaMealContext | undefined,
  food: PersonaFoodContext | undefined
): string {
  if (meal && food) return `${mealLabels[meal]}時の${foodLabels[food]}`;
  if (meal) return mealLabels[meal];
  if (food) return foodLabels[food];
  return "食生活";
}

function detectExplicitTopic(text: string): TopicDefinition | undefined {
  return topicDefinitions.find((topic) =>
    topic.patterns.some((pattern) => pattern.test(text))
  );
}

function detectPriorityTopic(text: string): TopicDefinition | undefined {
  const t = compact(text);
  const byDomain = (domain: PersonaDetailDomain) =>
    topicDefinitions.find((topic) => topic.domain === domain);

  if (/食費|医療費|薬代|家計|金銭|経済的|費用面/.test(t)) {
    return byDomain("finance");
  }
  if (/ストレス|気分転換/.test(t)) {
    return byDomain("stress");
  }
  if (/薬について|薬の不安|薬の心配|副作用/.test(t)) {
    return byDomain("medication");
  }
  if (/家族.{0,12}病気|病気.{0,12}家族/.test(t)) {
    return byDomain("medical");
  }
  if (/誰と.{0,8}暮ら|誰に.{0,8}相談|相談できる人|相談相手/.test(t)) {
    return byDomain("family");
  }
  return undefined;
}

function isAnaphoricFollowup(text: string, dimension: PersonaDetailDimension): boolean {
  const t = compact(text);
  return (
    /^(その|それ|そこ|では|じゃあ|ちなみに|もう少し|具体的には|どれくらい|どのくらい|何回|何分|何時間|何時|なぜ|どうして|理由は|量は)/.test(
      t
    ) ||
    (dimension !== "detail" && t.length <= 24)
  );
}

export function detectPersonaDetailRequest(
  text: string,
  previous?: PersonaDetailRequest | null
): PersonaDetailRequest | null {
  const original = compact(text);
  const isCorrection =
    /ではなく|じゃなく|違います|違う|そうではなく|聞いています|聞きたいのは|聞いているのは|質問しているのは/.test(
      original
    );
  const focus = isCorrection ? correctionFocus(text) : original;
  const dimension = detailDimension(focus);

  const meal = detectMeal(focus);
  const food = detectFood(focus);
  const priorityTopic = detectPriorityTopic(focus);

  if (!priorityTopic && (isDietCue(focus) || meal || food)) {
    const inheritedMeal =
      !meal && previous?.domain === "diet" && isAnaphoricFollowup(focus, dimension)
        ? previous.meal
        : meal;
    const inheritedFood =
      !food && previous?.domain === "diet" && isAnaphoricFollowup(focus, dimension)
        ? previous.food
        : food;

    const explicitDetail =
      dimension !== "detail" ||
      isCorrection ||
      Boolean(inheritedMeal && inheritedFood) ||
      /具体的|詳しく|どのよう|どんな/.test(focus);

    if (!explicitDetail) return null;

    const resolvedDimension =
      dimension === "detail" && inheritedMeal && inheritedFood
        ? "presence"
        : dimension;

    return {
      key: buildDietKey(inheritedMeal, inheritedFood, resolvedDimension),
      label: buildDietLabel(inheritedMeal, inheritedFood),
      domain: "diet",
      subject: inheritedFood ?? inheritedMeal ?? "general",
      dimension: resolvedDimension,
      meal: inheritedMeal,
      food: inheritedFood,
      isCorrection,
      queryText: text,
    };
  }

  const explicitTopic = priorityTopic ?? detectExplicitTopic(focus);

  if (
    !explicitTopic &&
    previous &&
    isAnaphoricFollowup(focus, dimension) &&
    dimension !== "detail"
  ) {
    const previousBase = previous.key.split(".").slice(0, -1).join(".");
    return {
      ...previous,
      key: `${previousBase}.${dimension}`,
      dimension,
      isCorrection,
      queryText: text,
    };
  }

  const motivationDimensions: PersonaDetailDimension[] = [
    "confidence",
    "importance",
    "readiness",
    "benefit",
    "disadvantage",
    "goal",
    "strategy",
    "barrier",
  ];
  const resolvedTopic =
    explicitTopic ??
    (motivationDimensions.includes(dimension)
      ? topicDefinitions.find((topic) => topic.domain === "motivation")
      : undefined);

  if (resolvedTopic) {
    const explicitDetail =
      dimension !== "detail" ||
      isCorrection ||
      /具体的|詳しく|どのよう|どんな|どうですか|どうでした|教えて|聞かせて/.test(focus);

    if (!explicitDetail) return null;

    if (
      previous &&
      previous.domain === resolvedTopic.domain &&
      /^(その日|その時|その場合|それは|そこでは)/.test(focus)
    ) {
      const previousBase = previous.key.split(".").slice(0, -1).join(".");
      return {
        ...previous,
        key: `${previousBase}.${dimension}`,
        dimension,
        isCorrection,
        queryText: text,
      };
    }

    const subject = detectDetailSubject(resolvedTopic.domain, focus);

    return {
      key: buildDomainDetailKey(
        resolvedTopic.domain,
        resolvedTopic.baseKey,
        subject,
        dimension
      ),
      label: subject?.label ?? resolvedTopic.label,
      domain: resolvedTopic.domain,
      subject: subject?.key ?? resolvedTopic.baseKey.split(".")[1],
      dimension,
      isCorrection,
      queryText: text,
    };
  }

  if (
    previous &&
    isAnaphoricFollowup(focus, dimension) &&
    (dimension !== "detail" || isCorrection)
  ) {
    const base = previous.key.split(".").slice(0, -1).join(".");
    return {
      ...previous,
      key: `${base}.${dimension}`,
      dimension,
      isCorrection,
      queryText: text,
    };
  }

  return null;
}

function nonEmpty(parts: Array<string | undefined>): string[] {
  return parts.map((x) => x?.trim()).filter((x): x is string => Boolean(x));
}

function labeled(label: string, value?: string): string {
  return value?.trim() ? `${label}: ${value.trim()}` : "";
}

function evidenceForDomain(persona: Persona, domain: PersonaDetailDomain): string[] {
  switch (domain) {
    case "diet":
      return nonEmpty([
        labeled("普段の食生活", persona.diet),
        labeled("生活習慣記述", persona.personaLifestyle),
      ]);
    case "exercise":
      return nonEmpty([
        labeled("運動習慣", persona.exercise),
        labeled("生活習慣記述", persona.personaLifestyle),
        labeled("大切にしている活動", persona.values),
        labeled("職業", persona.occupation),
      ]);
    case "smoking":
      return nonEmpty([
        labeled("喫煙歴", persona.smoking),
        labeled("生活習慣記述", persona.personaLifestyle),
      ]);
    case "alcohol":
      return nonEmpty([
        labeled("飲酒歴", persona.alcohol),
        labeled("生活習慣記述", persona.personaLifestyle),
      ]);
    case "sleep":
      return nonEmpty([
        labeled("睡眠", persona.sleep),
        labeled("生活習慣記述", persona.personaLifestyle),
        labeled("職業", persona.occupation),
      ]);
    case "work":
      return nonEmpty([
        labeled("職業", persona.occupation),
        labeled("経済的制約", persona.economicConstraint),
        labeled("生活背景", persona.personaLifestyleBackground),
        labeled("生活習慣記述", persona.personaLifestyle),
      ]);
    case "checkup":
      return nonEmpty([
        labeled("健診歴", persona.checkupHistory),
        labeled("身長", persona.height),
        labeled("体重", persona.weight),
        labeled("BMI", persona.bmi),
        labeled("バイタルサイン", persona.vitalSigns),
        labeled("血液検査", persona.bloodTests),
        labeled("医学的背景", persona.personaMedicalBackground),
      ]);
    case "medical":
      return nonEmpty([
        labeled("主病名", persona.primaryDiagnosis),
        labeled("受診理由・主訴", persona.chiefComplaint),
        labeled("既往歴", persona.pastMedicalHistory),
        labeled("家族歴", persona.familyHistory),
        labeled("症状", persona.symptoms),
        labeled("医学的背景", persona.personaMedicalBackground),
      ]);
    case "medication":
      return nonEmpty([
        labeled("処方薬", persona.medications),
        labeled("服薬管理・アドヒアランス", persona.medicationAdherence),
        labeled("治療方針・治療目標", persona.treatmentGoals),
      ]);
    case "family":
      return nonEmpty([
        labeled("同居状況", persona.household),
        labeled("家族関係・キーパーソン", persona.familyRelationship),
        labeled("家族歴", persona.familyHistory),
        labeled("生活支援", persona.livingSupport),
        labeled("生活背景", persona.personaLifestyleBackground),
      ]);
    case "social":
      return nonEmpty([
        labeled("社会参加・孤立", persona.socialParticipation),
        labeled("生活支援", persona.livingSupport),
        labeled("生活背景", persona.personaLifestyleBackground),
      ]);
    case "finance":
      return nonEmpty([
        labeled("経済的制約", persona.economicConstraint),
        labeled("生活背景", persona.personaLifestyleBackground),
      ]);
    case "healthcare":
      return nonEmpty([
        labeled("かかりつけ・医療利用状況", persona.healthcareUse),
        labeled("医療アクセス・通院手段", persona.healthcareAccess),
        labeled("居住環境", persona.livingEnvironment),
        labeled("ADL/IADL", persona.adlIadl),
      ]);
    case "values":
      return nonEmpty([
        labeled("趣味・大切にしている活動", persona.values),
        labeled("価値観・心理面", persona.personaPsychology),
        labeled("代表発話", persona.representativeUtterance),
      ]);
    case "stress":
      return nonEmpty([
        labeled("価値観・心理面", persona.personaPsychology),
        labeled("生活背景", persona.personaLifestyleBackground),
        labeled("統合記述", persona.personaIntegrated),
        labeled("職業", persona.occupation),
        labeled("家族関係", persona.familyRelationship),
      ]);
    case "motivation":
      return nonEmpty([
        labeled("価値観・心理面", persona.personaPsychology),
        labeled("支援ポイント", persona.personaSupportPoints),
        labeled("代表発話", persona.representativeUtterance),
        labeled("大切にしている活動", persona.values),
        labeled("職業", persona.occupation),
        labeled("経済的制約", persona.economicConstraint),
      ]);
  }
}

function evidenceForSpecificSubject(
  persona: Persona,
  request: PersonaDetailRequest
): string[] | null {
  if (request.domain === "checkup") {
    switch (request.subject) {
      case "weight":
        return nonEmpty([labeled("体重", persona.weight)]);
      case "bmi":
        return nonEmpty([labeled("BMI", persona.bmi)]);
      case "waist":
        return nonEmpty([
          labeled("健診歴", persona.checkupHistory),
          labeled("医学的背景", persona.personaMedicalBackground),
        ]);
      case "blood_pressure":
        return nonEmpty([labeled("バイタルサイン", persona.vitalSigns)]);
      case "glucose":
      case "hba1c":
      case "lipids":
      case "liver":
        return nonEmpty([labeled("血液検査", persona.bloodTests)]);
    }
  }

  if (request.domain === "medical") {
    switch (request.subject) {
      case "diagnosis":
        return nonEmpty([
          labeled("主病名", persona.primaryDiagnosis),
          labeled("既往歴", persona.pastMedicalHistory),
        ]);
      case "symptom":
        return nonEmpty([
          labeled("症状", persona.symptoms),
          labeled("受診理由・主訴", persona.chiefComplaint),
        ]);
      case "family_history":
        return nonEmpty([labeled("家族歴", persona.familyHistory)]);
      case "treatment":
        return nonEmpty([
          labeled("治療方針・治療目標", persona.treatmentGoals),
          labeled("医学的背景", persona.personaMedicalBackground),
        ]);
    }
  }

  if (request.domain === "medication") {
    switch (request.subject) {
      case "adherence":
        return nonEmpty([
          labeled("服薬管理・アドヒアランス", persona.medicationAdherence),
          labeled("処方薬", persona.medications),
        ]);
      case "timing":
        return nonEmpty([
          labeled("処方薬", persona.medications),
          labeled("服薬管理・アドヒアランス", persona.medicationAdherence),
        ]);
      case "concern":
        return nonEmpty([
          labeled("服薬管理・アドヒアランス", persona.medicationAdherence),
          labeled("価値観・心理面", persona.personaPsychology),
        ]);
    }
  }

  return null;
}

export function personaEvidenceForDetail(
  scenario: Scenario,
  request: PersonaDetailRequest
): string {
  const specific = evidenceForSpecificSubject(scenario.persona, request);
  return (specific ?? evidenceForDomain(scenario.persona, request.domain)).join("\n");
}

export function formatSessionMemory(memory: PersonaSessionMemory): string {
  const entries = Object.entries(memory);
  if (!entries.length) return "まだ追加設定はありません。";
  return entries.map(([key, value]) => `- ${key}: ${value}`).join("\n");
}

export function isPersonaDetailAnswerValid(
  request: PersonaDetailRequest,
  answer: string
): boolean {
  const text = compact(answer);
  if (!text) return false;

  switch (request.dimension) {
    case "amount":
      return /[0-9０-９一二三四五六七八九十]+(?:皿|個|杯|本|g|グラム|ml|mL|合|割|品|人分)|小鉢|片手|両手|ひとつかみ|一人分|半分|少なめ|多め/.test(
        text
      );
    case "frequency":
      return /週|月|年|毎日|日くらい|回くらい|回程度|何度か|ほぼ毎日|時々|たまに/.test(
        text
      );
    case "duration":
      return /[0-9０-９一二三四五六七八九十]+(?:分|時間|年|か月|ヶ月)|しばらく|短時間|長時間/.test(
        text
      );
    case "time":
      return /[0-9０-９一二三四五六七八九十]+時|朝|昼|夕方|夜|帰宅後|起床後|就寝前|勤務前|勤務後/.test(
        text
      );
    case "intensity":
      return /軽い|中くらい|きつい|息|汗|ゆっくり|速め|強度|ペース/.test(text);
    case "reason":
      return /から|ので|ため|きっかけ|理由|思って|気になって/.test(text);
    case "trigger":
      return /時|場面|きっかけ|区切り|とき|時に|なると/.test(text);
    case "barrier":
      return /難|忙|時間|費用|仕事|続|負担|疲|面倒|自信|家族|環境/.test(text);
    case "support":
      return /家族|夫|妻|子|友人|職場|同僚|相談|手伝|協力|支援|頼/.test(text);
    case "confidence":
      return /自信|できそう|できる|難しい|不安|続けられ/.test(text);
    case "importance":
      return /大切|大事|重要|気になる|優先|必要/.test(text);
    case "goal":
      return /目標|したい|やってみ|変え|増や|減ら|続け/.test(text);
    case "readiness":
      return /今は|まだ|そろそろ|始め|取り組|やってみ|準備|気持ち/.test(text);
    case "benefit":
      return /良|楽|安心|改善|減ら|増や|できる|メリット/.test(text);
    case "disadvantage":
      return /困|嫌|面倒|負担|時間|我慢|楽しみ|付き合い|デメリット/.test(text);
    case "understanding":
      return /分か|わか|理解|気にな|驚|思って|受け止め/.test(text);
    case "strategy":
      return /なら|工夫|時間|決め|準備|置く|選ぶ|一緒|少しずつ|やり方|気分を切り替|休める|短く|好きなこと/.test(text);
    case "history":
      return /以前|前は|これまで|過去|昔|ことがある|受けた|試した|続いた|やめた/.test(
        text
      );
    case "context":
      return /家|自宅|職場|外|一人|家族|友人|店|通勤|勤務|朝食|昼食|夕食|食事|会食|飲み会/.test(text);
    case "preference":
      return /好き|嫌い|選ぶ|好み|方が|ほしい/.test(text);
    case "change":
      return /変わ|増え|減っ|以前|前より|最近/.test(text);
    case "presence":
      return /はい|いいえ|してい|しています|してません|ありません|あります|ある|ない|なし|いる|いない|食べ|飲み|吸い|通い|受け|使っ/.test(
        text
      );
    case "items":
      return text.length >= 6;
    case "detail":
      return text.length >= 4;
  }
}

function stableIndex(seed: string, size: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % size;
}

function pickStable(seed: string, values: string[]): string {
  return values[stableIndex(seed, values.length)] ?? values[0];
}

function naturalUnknown(persona: Persona, label: string): string {
  if (persona.talkativeness === "low") {
    return `${label}については、そこまで細かくは意識していないです。`;
  }
  if (persona.healthLiteracy === "高") {
    return `${label}については、普段そこまで細かく記録していないので、今ははっきりとは答えにくいです。`;
  }
  return `${label}については、そこまで細かく意識していないので、具体的にはちょっと分からないです。`;
}

function dietFallback(
  scenario: Scenario,
  request: PersonaDetailRequest,
  memory: PersonaSessionMemory
): string {
  const p = scenario.persona;
  const diet = p.diet || "";
  const key = request.key;
  const seed = `${p.id}:${key}`;

  const relatedMemory = Object.entries(memory)
    .filter(([memoryKey]) => {
      if (request.meal && !memoryKey.includes(`.${request.meal}.`)) return false;
      if (request.food && !memoryKey.includes(`.${request.food}.`)) return false;
      return true;
    })
    .map(([, value]) => value)
    .join(" ");

  if (request.meal && request.food && request.dimension === "presence") {
    if (
      request.food === "vegetables" &&
      /野菜|サラダ|副菜|青菜|根菜|トマト|キャベツ/.test(relatedMemory)
    ) {
      return `はい、${mealLabels[request.meal]}では野菜も食べています。`;
    }
    if (request.food === "vegetables") {
      return pickStable(seed, [
        `はい、${mealLabels[request.meal]}では野菜のおかずを一品食べることがあります。`,
        `はい、${mealLabels[request.meal]}ではサラダや副菜として野菜を食べています。`,
      ]);
    }
    return `はい、${mealLabels[request.meal]}では${foodLabels[request.food]}を食べることがあります。`;
  }

  if (request.food === "vegetables" && request.dimension === "amount") {
    const mealPrefix = request.meal ? `${mealLabels[request.meal]}では、` : "";
    return pickStable(seed, [
      `${mealPrefix}野菜は小鉢1皿くらいです。サラダなら片手に軽くのるくらいの量だと思います。`,
      `${mealPrefix}野菜のおかずは小鉢1皿程度で、たくさん食べるというほどではありません。`,
    ]);
  }

  if (request.food === "vegetables" && request.dimension === "items") {
    const mealPrefix = request.meal ? `${mealLabels[request.meal]}では、` : "";
    return pickStable(seed, [
      `${mealPrefix}キャベツやレタス、トマトなどをサラダで食べることがあります。`,
      `${mealPrefix}青菜のおひたしや煮物、サラダなどを食べることがあります。`,
    ]);
  }

  if (request.meal && request.food === "noodles" && request.dimension === "items") {
    return pickStable(seed, [
      `${mealLabels[request.meal]}で麺類を食べる時は、うどんやそばが多いです。時々ラーメンを選ぶこともあります。`,
      `${mealLabels[request.meal]}の麺類は、うどん、そば、ラーメンあたりを選ぶことが多いです。`,
    ]);
  }

  if (request.meal && request.food && request.dimension === "frequency") {
    return pickStable(seed, [
      `${mealLabels[request.meal]}で${foodLabels[request.food]}を食べるのは、週に3〜4日くらいです。`,
      `${mealLabels[request.meal]}では、${foodLabels[request.food]}を週に4日くらい食べています。`,
    ]);
  }

  if (key.includes(".breakfast.") && request.dimension === "items") {
    if (/パン|トースト/.test(diet)) {
      return "朝はトーストに卵やヨーグルトを合わせることが多いです。野菜は毎朝ではありません。";
    }
    if (/米飯|ご飯|米/.test(diet)) {
      return "朝はご飯と味噌汁に、卵や納豆を付けることが多いです。野菜は毎朝ではありません。";
    }
  }

  if (key.includes(".lunch.") && request.dimension === "items") {
    if (/外食/.test(diet)) {
      return "昼は外で定食や丼物を食べることが多いです。時間がない日は麺類で済ませることもあります。";
    }
    if (/弁当|惣菜|調理済み/.test(diet)) {
      return "昼は弁当を買ったり、おにぎりと惣菜で済ませたりすることが多いです。";
    }
  }

  if (key.includes(".dinner.") && request.dimension === "items") {
    if (/家庭|自宅|家で/.test(diet)) {
      return "夕食は家で、ご飯に肉か魚のおかずと、野菜の副菜を合わせることが多いです。";
    }
  }

  if (request.dimension === "frequency") {
    if (request.food === "vegetables") {
      return "野菜は週に5日くらいは食べています。";
    }
    if (/多い|よく|中心/.test(diet)) {
      return `${request.label}は週に4〜5日くらいそうなることがあります。`;
    }
    if (/時々|ことがある|日がある/.test(diet)) {
      return `${request.label}は週に2〜3回くらいです。`;
    }
  }

  if (request.dimension === "time") {
    if (request.meal === "breakfast") return "朝食は7時台に食べることが多いです。";
    if (request.meal === "lunch") return "昼食は12時台に食べることが多いです。";
    if (request.meal === "dinner") return "夕食は帰宅後になるので、20時前後になることがあります。";
  }

  if (request.dimension === "amount") {
    return `${request.label}の量は特に計っていませんが、食べる時は一人分くらいだと思います。`;
  }

  if (request.dimension === "barrier") {
    if (/忙|残業|不規則|外回り/.test(p.occupation + (p.personaLifestyleBackground ?? ""))) {
      return "仕事の時間が不規則なので、毎日同じように食事を整えるのが難しいです。";
    }
    return "毎日同じように続けることが難しいです。";
  }

  return naturalUnknown(p, request.label);
}

function extractFirstUsefulEvidence(evidence: string): string {
  const first = evidence
    .split("\n")
    .map((x) => x.trim())
    .find(Boolean);
  if (!first) return "";
  const colon = first.indexOf(":");
  return colon >= 0 ? first.slice(colon + 1).trim() : first;
}

function evidenceContainsUsefulFact(
  evidence: string,
  request: PersonaDetailRequest
): boolean {
  const compacted = compact(evidence);
  if (!compacted) return false;

  if (request.dimension === "amount") {
    return /[0-9０-９一二三四五六七八九十]+(?:本|杯|合|皿|個|g|グラム|ml|mL|kg|キロ)/.test(compacted);
  }
  if (request.dimension === "frequency") {
    return /週|月|年|毎日|日|回|時々|たまに|ほぼ毎日/.test(compacted);
  }
  if (request.dimension === "duration") {
    return /[0-9０-９一二三四五六七八九十]+(?:分|時間|年|か月|ヶ月)/.test(compacted);
  }
  if (request.dimension === "time") {
    return /[0-9０-９一二三四五六七八九十]+時|朝|昼|夕方|夜|就寝|起床/.test(compacted);
  }
  return true;
}

function motivationFallback(
  scenario: Scenario,
  request: PersonaDetailRequest,
  state?: ConversationState
): string | null {
  const p = scenario.persona;

  if (request.dimension === "confidence" && state) {
    if (state.confidence >= 70) {
      return "全部を一度に変えるのは難しいですが、一つに絞ればできそうな気はしています。";
    }
    if (state.confidence >= 40) {
      return "できることもあると思いますが、続けられるかは少し不安です。";
    }
    return "必要なのは分かりますが、今の生活で続けられる自信はあまりありません。";
  }

  if (request.dimension === "importance" && state) {
    if (state.importance >= 70) {
      return "健康のことはかなり大切だと思っています。ただ、生活を無理に崩したくはないです。";
    }
    if (state.importance >= 40) {
      return "大事だとは思っていますが、仕事や生活の中では後回しになることがあります。";
    }
    return "必要なのは分かりますが、今はそこまで優先度が高いとは感じていません。";
  }

  if (request.dimension === "readiness" && state) {
    if (state.readiness >= 70) return "何か一つなら、そろそろ始めてもいいかなと思っています。";
    if (state.readiness >= 40) return "少し考えてはいますが、今すぐ決めるところまではいっていません。";
    return "今のところ、すぐに生活を変えようという気持ちにはなっていません。";
  }

  if (request.dimension === "benefit") {
    return "無理なく続けられて体調が少しでも良くなるなら、それはいいと思います。";
  }

  if (request.dimension === "disadvantage") {
    const text = [p.occupation, p.values, p.personaLifestyleBackground].join(" ");
    if (/忙|残業|夜勤|交代/.test(text)) {
      return "時間を決めてやることになると、仕事の都合で続けにくいのが困ります。";
    }
    return "今の生活の楽しみまで我慢する形になると、続けにくいと思います。";
  }

  if (request.dimension === "strategy") {
    if (/忙|残業|夜勤|交代/.test(p.occupation + p.personaLifestyleBackground)) {
      return "時間を固定するより、できる日に短くやる形なら続けやすい気がします。";
    }
    return "一度に大きく変えるより、今の生活の中で一つだけ変える方が続けやすそうです。";
  }

  if (request.dimension === "goal" && state) {
    if (state.decisionStatus === "self_selected_goal") {
      return "自分で決めたことなら、まずはそれを続けてみたいです。";
    }
    if (state.readiness >= 55) {
      return "今の生活で無理のないことを一つ決めて、まず試してみたいです。";
    }
    return "まだ具体的な目標を決めるより、何ならできそうか考えたいです。";
  }

  return null;
}

function softDomainFallback(
  scenario: Scenario,
  request: PersonaDetailRequest,
  state?: ConversationState
): string | null {
  const p = scenario.persona;
  const seed = `${p.id}:${request.key}`;
  const workBusy = /忙|残業|夜勤|交代|不規則/.test(
    [p.occupation, p.personaLifestyleBackground].join(" ")
  );

  if (request.domain === "motivation") {
    return motivationFallback(scenario, request, state);
  }

  if (request.dimension === "barrier") {
    if (workBusy) return "仕事の時間が読みにくいので、決まった形で続けるのが難しいです。";
    if (p.economicConstraint && !/なし|特になし|制約なし/.test(p.economicConstraint)) {
      return "費用がかかることだと、毎日のこととして続けるのは少し難しいです。";
    }
    return "最初はできても、毎日の生活の中で続けることが一番難しいと思います。";
  }

  if (request.dimension === "support") {
    if (/独居|一人暮らし/.test(p.household + p.familyRelationship)) {
      return "普段は自分で決めることが多くて、毎日のことを手伝ってもらう人は特にいません。";
    }
    if (p.familyRelationship) {
      return `家族については、${p.familyRelationship}という状況です。頼めることなら相談はできると思います。`;
    }
  }

  if (request.domain === "stress" && request.dimension === "strategy") {
    return pickStable(seed, [
      "少し一人で過ごしたり、好きなことをして気分を切り替えることが多いです。",
      "休める時に休んだり、家では仕事のことを考えないようにすることがあります。",
    ]);
  }

  if (request.domain === "exercise" && request.dimension === "duration") {
    if (/ほとんど|なし|不足|少ない/.test(p.exercise)) {
      return "運動としてまとまってする時間はほとんどありません。歩くとしても移動の時くらいです。";
    }
    return pickStable(seed, [
      "1回にすると20〜30分くらいのことが多いです。",
      "長くても30分くらいで、短い日は10〜20分くらいです。",
    ]);
  }

  if (request.domain === "exercise" && request.dimension === "time") {
    if (workBusy) return "仕事の日は時間が一定ではないので、できるとしたら帰宅後か休日です。";
    return "平日は夕方か帰宅後、休日は日中にすることが多いです。";
  }

  if (request.domain === "exercise" && request.dimension === "frequency") {
    if (request.subject === "walking" && /通勤|移動|外回り/.test(p.exercise + p.occupation)) {
      return "歩くのは週に4〜5日くらいで、主に通勤や仕事の移動の時です。";
    }
    if (/定期的.*ない|運動.*なし|ほとんど/.test(p.exercise)) {
      return "運動として決めている回数は週0回で、日常の移動で歩く程度です。";
    }
    return "週に2〜3回くらいです。";
  }

  if (request.domain === "smoking" && request.dimension === "amount") {
    if (/吸わない|非喫煙|禁煙|なし/.test(p.smoking)) return "今は1日0本です。";
    return pickStable(seed, [
      "1日10本くらいです。",
      "1日15本くらいです。",
      "1日5〜10本くらいです。",
    ]);
  }

  if (request.domain === "smoking" && request.dimension === "history") {
    if (/禁煙|過去喫煙|以前/.test(p.smoking)) {
      return `喫煙については、${p.smoking}という経過です。`;
    }
    return pickStable(seed, [
      "以前に一度、しばらく禁煙したことはありますが、また吸うようになりました。",
      "これまでに禁煙を試したことはありますが、長くは続きませんでした。",
    ]);
  }

  if (request.domain === "sleep" && request.dimension === "duration") {
    const m = p.sleep.match(/[0-9０-９]+(?:〜|～|-)[0-9０-９]+時間(?:程度|くらい)?|[0-9０-９]+時間(?:程度|くらい)?/);
    if (m) return `普段の睡眠は${m[0]}です。`;
    return "普段は6時間くらいです。";
  }

  if (request.domain === "work" && request.dimension === "time") {
    if (request.subject === "overtime") return "残業の日は20時から21時頃に終わることが多いです。";
    return workBusy
      ? "普段は19時頃に終わりますが、残業の日は20時を過ぎることがあります。"
      : "普段は18時頃に仕事が終わります。";
  }

  if (request.domain === "work" && request.dimension === "frequency") {
    if (request.subject === "overtime") {
      return workBusy ? "残業は週に2〜3回くらいあります。" : "残業は週に1回あるかないかくらいです。";
    }
    if (request.subject === "shift") {
      return /夜勤|交代|シフト/.test(p.occupation) ? "週に2〜3回くらいです。" : "交代勤務はありません。";
    }
  }

  if (request.domain === "sleep" && request.dimension === "time") {
    if (request.subject === "bedtime") {
      return workBusy ? "仕事の日は遅くなることがあって、寝るのは23時から0時頃が多いです。" : "寝るのは23時頃が多いです。";
    }
    if (request.subject === "wakeup") return "起きるのは6時台が多いです。";
  }

  if (request.domain === "alcohol" && request.dimension === "context") {
    return /なし|飲まない/.test(p.alcohol)
      ? "普段はお酒を飲む場面はほとんどありません。"
      : "飲むとしたら、夕食の時か人と食事をする時が多いです。";
  }

  if (request.domain === "smoking" && request.dimension === "trigger") {
    return /吸わない|非喫煙|なし/.test(p.smoking)
      ? "今はたばこを吸わないので、吸いたくなる場面は特にありません。"
      : "仕事の区切りや、少し気分を切り替えたい時に吸いたくなることがあります。";
  }

  return null;
}

function genericFallback(
  scenario: Scenario,
  request: PersonaDetailRequest,
  memory: PersonaSessionMemory,
  state?: ConversationState
): string {
  const p = scenario.persona;
  const evidence = personaEvidenceForDetail(scenario, request);
  const firstEvidence = extractFirstUsefulEvidence(evidence);
  const existing = memory[request.key];
  if (existing) return existing;

  if (factLockedDomains.has(request.domain)) {
    if (!firstEvidence || !evidenceContainsUsefulFact(evidence, request)) {
      return naturalUnknown(p, request.label);
    }
  }

  const soft = syntheticDetailDomains.has(request.domain)
    ? softDomainFallback(scenario, request, state)
    : null;
  if (soft) return soft;

  if (request.domain === "exercise") {
    if (request.dimension === "frequency" && /週[1-9１-９]/.test(p.exercise)) {
      return `運動は${p.exercise}というくらいです。`;
    }
    if (request.dimension === "items") {
      if (/なし|少ない|不足|ほとんど/.test(p.exercise)) {
        return "運動として時間を取ることはあまりなく、普段の移動で歩く程度です。";
      }
      return `運動は${p.exercise}という感じです。具体的な種目は日によって違います。`;
    }
    if (request.dimension === "barrier") {
      if (/夜勤|交代|残業|多忙|忙/.test(p.occupation + p.personaLifestyleBackground)) {
        return "仕事の時間が一定ではないので、決まった時間に運動するのが難しいです。";
      }
      return "まとまった時間を作って続けることが難しいです。";
    }
  }

  if (request.domain === "smoking") {
    if (request.dimension === "presence") return `たばこは${p.smoking}です。`;
    if (request.dimension === "history") return `喫煙については、${p.smoking}という状況です。`;
  }

  if (request.domain === "alcohol") {
    if (request.dimension === "presence" || request.dimension === "frequency") {
      return `お酒は${p.alcohol}という状況です。`;
    }
  }

  if (request.domain === "sleep") {
    if (request.dimension === "presence" || request.dimension === "items") {
      return `睡眠は${p.sleep}という感じです。`;
    }
    if (request.dimension === "barrier" && /夜勤|交代|残業|多忙|忙/.test(p.occupation)) {
      return "仕事の時間によって寝る時間がずれるのが一番難しいところです。";
    }
  }

  if (request.domain === "work" && request.dimension === "items") {
    return `${p.occupation}の仕事をしています。`;
  }

  if (request.domain === "motivation") {
    if (request.dimension === "confidence" && state) {
      if (state.confidence >= 60) {
        return "全部を変えるのは難しいですが、一つならできそうな気はしています。";
      }
      return "やった方がいいとは思いますが、続けられるかにはまだ自信がありません。";
    }
    if (request.dimension === "importance" && state) {
      if (state.importance >= 60) {
        return "健康のことは大切だと思っています。ただ、今の生活との両立も大事にしたいです。";
      }
      return "必要なのは分かりますが、今はほかのことの優先度も高いです。";
    }
    if (request.dimension === "barrier") {
      const constraints = nonEmpty([
        p.economicConstraint &&
        !/^(特になし|なし|特に制約なし|制約なし|特段なし)$/.test(
          p.economicConstraint.trim()
        )
          ? p.economicConstraint
          : undefined,
        p.occupation ? `${p.occupation}の仕事との両立` : undefined,
      ]);
      if (constraints.length) {
        return `${constraints[0]}があるので、無理なく続けられるかが気になります。`;
      }
    }
  }

  if (firstEvidence) {
    if (request.dimension === "presence") {
      return `${request.label}については、${firstEvidence}という状況です。`;
    }
    if (
      request.dimension === "items" ||
      request.dimension === "history" ||
      request.dimension === "support" ||
      request.dimension === "context" ||
      request.dimension === "detail"
    ) {
      return `${request.label}については、${firstEvidence}という感じです。`;
    }
  }

  return naturalUnknown(p, request.label);
}

export function generatePersonaConsistentFallbackDetail(
  scenario: Scenario,
  request: PersonaDetailRequest,
  memory: PersonaSessionMemory,
  state?: ConversationState
): string {
  if (request.domain === "diet") {
    return dietFallback(scenario, request, memory);
  }
  return genericFallback(scenario, request, memory, state);
}

function parseJapaneseDigit(value: string): number | null {
  const normalized = value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const map: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
  };
  return map[value] ?? null;
}

function extractCurrentVegetableDays(memory: PersonaSessionMemory): number | null {
  const candidates = Object.entries(memory)
    .filter(
      ([key]) =>
        key.startsWith("diet.vegetables") || key.includes(".vegetables.")
    )
    .map(([, value]) => value);

  for (const text of candidates) {
    const negative = text.match(
      /(?:食べない|ほとんど食べない|十分に取れない).{0,12}週(?:に)?([0-7０-７一二三四五六七])日/
    );
    if (negative) {
      const n = parseJapaneseDigit(negative[1]);
      if (n !== null) return Math.max(0, 7 - n);
    }

    const positive = text.match(
      /野菜.{0,12}週(?:に)?([0-7０-７一二三四五六七])日/
    );
    if (positive) {
      const n = parseJapaneseDigit(positive[1]);
      if (n !== null) return n;
    }
  }

  return null;
}

export function checkProposalConsistency(
  text: string,
  memory: PersonaSessionMemory
): string | null {
  const t = text.replace(/\s+/g, "");

  if (/野菜/.test(t) && /週/.test(t)) {
    const currentDays = extractCurrentVegetableDays(memory);
    const targetMatch = t.match(/週(?:に)?([0-7０-７一二三四五六七])日/);
    if (currentDays !== null && targetMatch) {
      const target = parseJapaneseDigit(targetMatch[1]);
      if (target !== null && /食べる日/.test(t) && target < currentDays) {
        const suggested = Math.min(7, currentDays + 1);
        return `今のお話だと、野菜を食べる日は週に${currentDays}日くらいあります。週${target}日にするという意味だと、今より減ることになると思うのですが、週${suggested}日くらいに増やすという意味でしょうか。`;
      }
    }
  }

  return null;
}
