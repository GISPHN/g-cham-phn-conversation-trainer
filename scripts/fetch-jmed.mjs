import fs from "node:fs/promises";
import path from "node:path";

const DATASET = "sociocom/JMED-Personas";
const BASE = "https://datasets-server.huggingface.co";

async function json(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "g-cham-phn-conversation-trainer/0.4.1" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function pick(row) {
  const keys = [
    "患者ID","都道府県","年齢","性別","教育歴","医療・健康リテラシー","職業",
    "経済的制約","BMI","健診歴","家族歴","同居／独居","家族との関係性・キーパーソン",
    "社会参加・孤立","BIG FIVE性格特性","趣味・大切にしている活動",
    "患者の語り/代表発話","喫煙歴","飲酒歴","運動習慣","普段の食生活","睡眠"
  ];
  return Object.fromEntries(keys.map((key) => [key, row[key] ?? ""]));
}

async function main() {
  const dataset = encodeURIComponent(DATASET);
  const splits = await json(`${BASE}/splits?dataset=${dataset}`);
  const first = splits.splits?.find((s) => s.split === "train") ?? splits.splits?.[0];
  if (!first) throw new Error("No JMED dataset split found");

  const config = first.config;
  const split = first.split;
  const offsets = [0, 10000, 25000, 40000, 55000, 70000, 85000, 99000];
  const records = [];

  for (const offset of offsets) {
    const params = new URLSearchParams({
      dataset: DATASET,
      config,
      split,
      offset: String(offset),
      length: "100",
    });
    const data = await json(`${BASE}/rows?${params}`);
    for (const item of data.rows ?? []) {
      if (item?.row) records.push(pick(item.row));
    }
  }

  const eligible = records.filter((row) => {
    const age = Number(row["年齢"]);
    return Number.isFinite(age) && age >= 40 && age <= 74;
  });

  if (eligible.length < 50) {
    throw new Error(`Too few eligible JMED personas: ${eligible.length}`);
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
      records: eligible,
    }),
    "utf8"
  );
  console.log(`Bundled ${eligible.length} JMED-Personas records from config=${config}, split=${split}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
