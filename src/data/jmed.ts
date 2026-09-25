import { Persona, Scenario } from "../domain/types";

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

function normalizeLiteracy(value: string): "低" | "中" | "高" {
  if (/高/.test(value)) return "高";
  if (/低/.test(value)) return "低";
  return "中";
}

function toPersona(row: JmedRow): Persona {
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
