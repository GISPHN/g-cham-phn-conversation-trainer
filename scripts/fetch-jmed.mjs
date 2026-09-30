import fs from "node:fs/promises";
import path from "node:path";

const DATASET = "sociocom/JMED-Personas";
const BASE = "https://datasets-server.huggingface.co";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function json(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "g-cham-phn-conversation-trainer/0.7.0" },
      });
      if (response.ok) return response.json();

      const error = new Error(`${response.status} ${response.statusText}: ${url}`);
      if (!RETRYABLE_STATUS.has(response.status) || attempt === attempts) {
        throw error;
      }
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }

    const delayMs = 500 * 2 ** (attempt - 1);
    console.warn(
      `JMED fetch attempt ${attempt}/${attempts} failed; retrying in ${delayMs} ms: ${url}`
    );
    await sleep(delayMs);
  }
  throw lastError;
}

function pick(row) {
  const keys = [
    "患者ID","都道府県","年齢","性別","教育歴","医療・健康リテラシー","デジタルリテラシー・端末利用","職業",
    "経済的制約","主病名","受診理由・主訴","既往歴","症状","身長","体重","BMI","バイタルサイン","血液検査",
    "健診歴","家族歴","かかりつけ・医療利用状況","処方薬","服薬管理・アドヒアランス","治療方針・治療目標",
    "同居／独居","家族との関係性・キーパーソン","生活支援・介護資源","居住環境","医療アクセス・通院手段",
    "ADL/IADL","認知・意思決定能力","社会参加・孤立","BIG FIVE性格特性","趣味・大切にしている活動",
    "患者の語り/代表発話","喫煙歴","飲酒歴","運動習慣","普段の食生活","睡眠",
    "ペルソナ_医学的背景","ペルソナ_生活背景・支援状況","ペルソナ_価値観・心理面","ペルソナ_生活習慣",
    "ペルソナ_支援ポイント","ペルソナ_統合記述"
  ];
  return Object.fromEntries(keys.map((key) => [key, row[key] ?? ""]));
}

async function main() {
  const dataset = encodeURIComponent(DATASET);
  const splits = await json(`${BASE}/splits?dataset=${dataset}`, 5);
  const first = splits.splits?.find((s) => s.split === "train") ?? splits.splits?.[0];
  if (!first) throw new Error("No JMED dataset split found");

  const config = first.config;
  const split = first.split;
  const offsets = [0, 10000, 25000, 40000, 55000, 70000, 85000, 99000];
  const records = [];
  const failedOffsets = [];

  for (const offset of offsets) {
    const params = new URLSearchParams({
      dataset: DATASET,
      config,
      split,
      offset: String(offset),
      length: "100",
    });
    try {
      const data = await json(`${BASE}/rows?${params}`, 4);
      for (const item of data.rows ?? []) {
        if (item?.row) records.push(pick(item.row));
      }
    } catch (error) {
      failedOffsets.push(offset);
      console.warn(
        `Skipping JMED sample offset ${offset} after retries: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const eligible = records.filter((row) => {
    const age = Number(row["年齢"]);
    return Number.isFinite(age) && age >= 40 && age <= 74;
  });

  if (eligible.length < 50) {
    throw new Error(
      `Too few eligible JMED personas after retries: ${eligible.length}; failed offsets: ${failedOffsets.join(", ") || "none"}`
    );
  }

  const outDir = path.resolve("public");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "jmed-personas.sample.json"),
    JSON.stringify({
      dataset: DATASET,
      config,
      split,
      generatedAt: new Date().toISOString(),
      count: eligible.length,
      sampledOffsets: offsets.filter((offset) => !failedOffsets.includes(offset)),
      failedOffsets,
      records: eligible,
    }),
    "utf8"
  );

  console.log(
    `Bundled ${eligible.length} JMED-Personas records from config=${config}, split=${split}` +
      (failedOffsets.length ? `; skipped offsets=${failedOffsets.join(",")}` : "")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
