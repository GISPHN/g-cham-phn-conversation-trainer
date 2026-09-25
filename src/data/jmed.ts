import { Persona, Scenario } from "../domain/types";

const DATASET = "sociocom/JMED-Personas";
const CONFIG = "default";
const SPLIT = "train";
const TOTAL_ROWS = 100000;
const BATCH = 30;

type HfRow = {
  row_idx: number;
  row: Record<string, unknown>;
};

type HfRowsResponse = {
  rows: HfRow[];
};

const str = (row: Record<string, unknown>, key: string) => {
  const value = row[key];
  return value == null ? "" : String(value).trim();
};

const num = (row: Record<string, unknown>, key: string) => {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : NaN;
};

function scoreRow(row: Record<string, unknown>, scenarioId: string): number {
  const age = num(row, "年齢");
  if (!Number.isFinite(age) || age < 40 || age > 74) return -999;

  let score = 10;
  const exercise = str(row, "運動習慣");
  const diet = str(row, "普段の食生活");
  const literacy = str(row, "医療・健康リテラシー");
  const occupation = str(row, "職業");
  const bmiText = str(row, "BMI");
  const bmi = Number.parseFloat(bmiText);

  if (Number.isFinite(bmi) && bmi >= 23) score += 3;
  if (/少ない|なし|不足|ほとんど/.test(exercise)) score += 3;
  if (/外食|惣菜|調理済み|肉料理|野菜.*少/.test(diet)) score += 2;

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

function toPersona(row: Record<string, unknown>): Persona {
  return {
    id: str(row, "患者ID") || crypto.randomUUID(),
    age: num(row, "年齢"),
    sex: str(row, "性別"),
    occupation: str(row, "職業"),
    healthLiteracy: /高/.test(str(row, "医療・健康リテラシー"))
      ? "高"
      : /低/.test(str(row, "医療・健康リテラシー"))
      ? "低"
      : "中",
    economicConstraint: str(row, "経済的制約"),
    household: str(row, "同居／独居"),
    familyRelationship: str(row, "家族との関係性・キーパーソン"),
    smoking: str(row, "喫煙歴"),
    alcohol: str(row, "飲酒歴"),
    exercise: str(row, "運動習慣"),
    diet: str(row, "普段の食生活"),
    sleep: str(row, "睡眠"),
    values:
      str(row, "趣味・大切にしている活動") ||
      str(row, "ペルソナ_価値観・心理面"),
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

async function fetchBatch(offset: number): Promise<HfRow[]> {
  const params = new URLSearchParams({
    dataset: DATASET,
    config: CONFIG,
    split: SPLIT,
    offset: String(offset),
    length: String(BATCH),
  });
  const response = await fetch(
    `https://datasets-server.huggingface.co/rows?${params.toString()}`
  );
  if (!response.ok) throw new Error(`JMED_HTTP_${response.status}`);
  const data = (await response.json()) as HfRowsResponse;
  return data.rows ?? [];
}

export async function loadJmedPersona(
  scenario: Scenario
): Promise<Persona> {
  let best: { score: number; persona: Persona } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const maxOffset = TOTAL_ROWS - BATCH - 1;
    const offset = Math.floor(Math.random() * maxOffset);
    const rows = await fetchBatch(offset);

    for (const item of rows) {
      const score = scoreRow(item.row, scenario.id);
      if (!best || score > best.score) {
        if (score > -999) best = { score, persona: toPersona(item.row) };
      }
    }

    if (best && best.score >= 17) break;
  }

  if (!best) throw new Error("JMED_NO_ELIGIBLE_PERSONA");
  return best.persona;
}

export function withPersona(scenario: Scenario, persona: Persona): Scenario {
  return { ...scenario, persona };
}
