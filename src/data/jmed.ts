import { Persona, Scenario, TrainingProfile } from "../domain/types";

type JmedRow = Record<string, unknown>;

type BundledJmed = {
  dataset: string;
  config: string;
  split: string;
  generatedAt: string;
  count: number;
  records: JmedRow[];
};

const str = (row: JmedRow, key: string) => {
  const value = row[key];
  return value == null ? "" : String(value).trim();
};

const num = (row: JmedRow, key: string) => {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : NaN;
};

function scoreRow(row: JmedRow, scenarioId: string): number {
  const age = num(row, "年齢");
  if (!Number.isFinite(age) || age < 40 || age > 74) return -999;

  let score = 10;
  const exercise = str(row, "運動習慣");
  const diet = str(row, "普段の食生活");
  const literacy = str(row, "医療・健康リテラシー");
  const occupation = str(row, "職業");
  const bmi = Number.parseFloat(str(row, "BMI"));

  if (Number.isFinite(bmi) && bmi >= 23) score += 3;
  if (/少ない|なし|不足|ほとんど|運動習慣なし/.test(exercise)) score += 3;
  if (/外食|惣菜|調理済み|野菜.*少/.test(diet)) score += 2;

  if (scenarioId === "shi-01") {
    if (/営業|管理|販売|会社|運転|事務|技術|サービス/.test(occupation)) score += 3;
    if (/外食/.test(diet)) score += 3;
  } else if (scenarioId === "shi-02") {
    if (age >= 50) score += 3;
  } else if (scenarioId === "shi-03") {
    if (/高|中等度/.test(literacy)) score += 2;
  }

  return score;
}

function behaviorRiskCount(row: JmedRow): number {
  let count = 0;
  const exercise = str(row, "運動習慣");
  const diet = str(row, "普段の食生活");
  const alcohol = str(row, "飲酒歴");
  const smoking = str(row, "喫煙歴");
  const sleep = str(row, "睡眠");

  if (/少ない|なし|不足|ほとんど|運動習慣なし/.test(exercise)) count += 1;
  if (/外食|惣菜|調理済み|野菜.*少|不規則|偏/.test(diet)) count += 1;
  if (/毎日|ほぼ毎日|多い|過量/.test(alcohol)) count += 1;
  if (/現在.*喫煙|喫煙中|毎日.*吸/.test(smoking)) count += 1;
  if (/短い|不足|5時間|不規則/.test(sleep)) count += 1;

  return count;
}

function personaComplexity(row: JmedRow): number {
  let score = 0;
  const economic = str(row, "経済的制約");
  const household = str(row, "同居／独居");
  const family = str(row, "家族との関係性・キーパーソン");
  const social = str(row, "社会参加・孤立");
  const literacy = str(row, "医療・健康リテラシー");
  const occupation = str(row, "職業");

  if (economic && !/特になし|なし|制約なし/.test(economic)) score += 2;
  if (/独居|孤立|交流.*少|支援.*なし|疎遠/.test(household + social + family)) score += 2;
  if (/夜勤|交代|不規則|長時間|残業|多忙|忙/.test(occupation + economic)) score += 1;
  if (/低/.test(literacy)) score += 1;
  score += Math.min(3, behaviorRiskCount(row));

  return score;
}

function decisionCompatibility(
  row: JmedRow,
  status: TrainingProfile["initialDecisionStatus"]
): number {
  const text = [
    str(row, "患者の語り/代表発話"),
    str(row, "健診歴"),
    str(row, "普段の食生活"),
    str(row, "運動習慣"),
  ].join(" ");

  if (status === "not_considering") {
    return /気にしていない|問題ない|必要ない|困っていない|変えるつもり.*ない/.test(text)
      ? 5
      : 0;
  }
  if (status === "ambivalent") {
    return /分かって.*けど|わかって.*けど|気になる.*けど|でも|続か|難しい|迷/.test(text)
      ? 5
      : 1;
  }
  if (status === "considering") {
    return /気になる|改善|変えたい|考えて|見直/.test(text) ? 5 : 1;
  }
  return /やってみ|できそう|少しなら|始めて|取り組/.test(text) ? 5 : 1;
}

function scoreTrainingRow(row: JmedRow, profile: TrainingProfile): number {
  const age = num(row, "年齢");
  if (!Number.isFinite(age) || age < 40 || age > 74) return -999;

  const complexity = personaComplexity(row);
  const targetComplexity =
    profile.difficulty === "初級" ? 2 : profile.difficulty === "標準" ? 5 : 8;
  const difficultyFit = Math.max(0, 10 - Math.abs(complexity - targetComplexity) * 2);

  const risks = behaviorRiskCount(row);
  let supportFit = 0;
  if (profile.supportType === "積極的支援") {
    supportFit += risks >= 2 ? 4 : 1;
    if (/連続|毎年|複数回|継続/.test(str(row, "健診歴"))) supportFit += 2;
  } else {
    supportFit += risks <= 2 ? 4 : 2;
  }

  return 10 + difficultyFit + supportFit + decisionCompatibility(row, profile.initialDecisionStatus);
}

function normalizeLiteracy(value: string): "低" | "中" | "高" {
  if (/高/.test(value)) return "高";
  if (/低/.test(value)) return "低";
  return "中";
}

function deriveTalkativeness(row: JmedRow): "low" | "medium" | "high" {
  const utterance = str(row, "患者の語り/代表発話");
  const social = str(row, "社会参加・孤立");
  const bigFive = str(row, "BIG FIVE性格特性");

  let score = 0;

  if (utterance.length >= 80) score += 2;
  else if (utterance.length >= 45) score += 1;
  else if (utterance.length <= 20) score -= 2;

  if (/外向的|社交的|積極的|交流.*多|参加.*多|友人.*多/.test(bigFive + social)) score += 2;
  if (/内向的|孤立|交流.*少|参加.*少|人付き合い.*少/.test(bigFive + social)) score -= 2;

  if (/外向性.{0,12}(高|4|5)/.test(bigFive)) score += 2;
  if (/外向性.{0,12}(低|1|2)/.test(bigFive)) score -= 2;

  if (score >= 2) return "high";
  if (score <= -2) return "low";
  return "medium";
}

function deriveInitiative(
  row: JmedRow,
  talkativeness: "low" | "medium" | "high"
): "low" | "medium" | "high" {
  const bigFive = str(row, "BIG FIVE性格特性");
  const social = str(row, "社会参加・孤立");

  if (/積極的|主体的|外向的|社交的/.test(bigFive + social)) return "high";
  if (/消極的|内向的|孤立/.test(bigFive + social)) return "low";
  return talkativeness === "high" ? "high" : talkativeness === "low" ? "low" : "medium";
}

function toPersona(row: JmedRow): Persona {
  const talkativeness = deriveTalkativeness(row);
  const initiative = deriveInitiative(row, talkativeness);

  return {
    id: str(row, "患者ID") || crypto.randomUUID(),
    age: num(row, "年齢"),
    sex: str(row, "性別"),
    occupation: str(row, "職業"),
    healthLiteracy: normalizeLiteracy(str(row, "医療・健康リテラシー")),
    economicConstraint: str(row, "経済的制約"),
    household: str(row, "同居／独居"),
    familyRelationship: str(row, "家族との関係性・キーパーソン"),
    smoking: str(row, "喫煙歴"),
    alcohol: str(row, "飲酒歴"),
    exercise: str(row, "運動習慣"),
    diet: str(row, "普段の食生活"),
    sleep: str(row, "睡眠"),
    values: str(row, "趣味・大切にしている活動"),
    representativeUtterance:
      str(row, "患者の語り/代表発話") || "よろしくお願いします。",
    education: str(row, "教育歴"),
    prefecture: str(row, "都道府県"),
    bigFive: str(row, "BIG FIVE性格特性"),
    socialParticipation: str(row, "社会参加・孤立"),
    familyHistory: str(row, "家族歴"),
    checkupHistory: str(row, "健診歴"),
    source: "JMED-Personas",
    sourceId: str(row, "患者ID"),
    talkativeness,
    initiative,
  };
}

async function loadBundledRows(): Promise<JmedRow[]> {
  const url = `${import.meta.env.BASE_URL}jmed-personas.sample.json`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`JMED_BUNDLE_HTTP_${response.status}`);
  }
  const data = (await response.json()) as BundledJmed;
  if (!Array.isArray(data.records) || data.records.length === 0) {
    throw new Error("JMED_BUNDLE_EMPTY");
  }
  return data.records;
}

export async function loadJmedPersona(
  scenario: Scenario
): Promise<Persona> {
  const rows = await loadBundledRows();

  const ranked = rows
    .map((row) => ({ row, score: scoreRow(row, scenario.id) }))
    .filter((item) => item.score > -999)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) throw new Error("JMED_NO_ELIGIBLE_PERSONA");

  const top = ranked.slice(0, Math.min(30, ranked.length));
  const selected = top[Math.floor(Math.random() * top.length)];
  return toPersona(selected.row);
}

export function withPersona(scenario: Scenario, persona: Persona): Scenario {
  return { ...scenario, persona };
}


export async function loadJmedPersonaForTraining(
  profile: TrainingProfile,
  excludeSourceId?: string
): Promise<Persona> {
  const rows = await loadBundledRows();

  const ranked = rows
    .map((row) => ({ row, score: scoreTrainingRow(row, profile) }))
    .filter(
      (item) =>
        item.score > -999 &&
        (!excludeSourceId || str(item.row, "患者ID") !== excludeSourceId)
    )
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) throw new Error("JMED_NO_TRAINING_PERSONA");

  const poolSize =
    profile.difficulty === "上級" ? 24 : profile.difficulty === "標準" ? 30 : 36;
  const top = ranked.slice(0, Math.min(poolSize, ranked.length));
  const selected = top[Math.floor(Math.random() * top.length)];
  return toPersona(selected.row);
}
