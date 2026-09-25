import { Persona, Scenario } from "../domain/types";

export type PersonaSessionMemory = Record<string, string>;

export type PersonaDetailRequest = {
  key: string;
  label: string;
};

const compact = (text: string) => text.replace(/\s+/g, "");

function detailDimension(text: string): string {
  const t = compact(text);
  if (/どんな|何を|種類|具体的/.test(t)) return "items";
  if (/何回|頻度|週に|毎日|何日/.test(t)) return "frequency";
  if (/どれくらい|どのくらい|量|何皿|何個|何杯/.test(t)) return "amount";
  if (/何時|時間帯|いつ食べ|何時頃/.test(t)) return "time";
  return "detail";
}

export function detectPersonaDetailRequest(
  text: string
): PersonaDetailRequest | null {
  const t = compact(text);
  const dimension = detailDimension(t);

  const topics: Array<[RegExp, string, string]> = [
    [/朝食|朝ごはん|朝ご飯/, "diet.breakfast", "朝食"],
    [/昼食|昼ごはん|昼ご飯|ランチ/, "diet.lunch", "昼食"],
    [/夕食|夕ごはん|夕ご飯|夕飯|晩ごはん/, "diet.dinner", "夕食"],
    [/野菜|サラダ/, "diet.vegetables", "野菜"],
    [/果物|フルーツ/, "diet.fruit", "果物"],
    [/肉|肉料理/, "diet.meat", "肉料理"],
    [/魚|魚料理/, "diet.fish", "魚料理"],
    [/主食|ご飯|米|パン|麺/, "diet.staple", "主食"],
    [/間食|お菓子|菓子|おやつ/, "diet.snack", "間食"],
    [/外食|惣菜|弁当/, "diet.eatingout", "外食・惣菜"],
    [/運動|歩く|歩行|身体活動/, "exercise.activity", "運動"],
    [/睡眠|寝る|眠る|就寝|起床/, "sleep.pattern", "睡眠"],
    [/お酒|飲酒|アルコール|ビール|晩酌/, "alcohol.pattern", "飲酒"],
    [/仕事|勤務|残業|働/, "work.pattern", "仕事"],
  ];

  const topic = topics.find(([regex]) => regex.test(t));
  if (!topic) return null;

  const specificQuestion =
    /どんな|何を|具体的|種類|何回|頻度|週に|毎日|何日|どれくらい|どのくらい|量|何皿|何個|何杯|何時|時間帯|いつ/.test(
      t
    );

  if (!specificQuestion) return null;

  return {
    key: `${topic[1]}.${dimension}`,
    label: topic[2],
  };
}

function sourceTextForKey(persona: Persona, key: string): string {
  if (key.startsWith("diet.")) return persona.diet;
  if (key.startsWith("exercise.")) return persona.exercise;
  if (key.startsWith("sleep.")) return persona.sleep;
  if (key.startsWith("alcohol.")) return persona.alcohol;
  if (key.startsWith("work.")) {
    return [persona.occupation, persona.economicConstraint].filter(Boolean).join("。");
  }
  return "";
}

export function personaEvidenceForDetail(
  scenario: Scenario,
  request: PersonaDetailRequest
): string {
  return sourceTextForKey(scenario.persona, request.key);
}

export function formatSessionMemory(memory: PersonaSessionMemory): string {
  const entries = Object.entries(memory);
  if (!entries.length) return "まだ追加設定はありません。";
  return entries.map(([key, value]) => `- ${key}: ${value}`).join("\n");
}
