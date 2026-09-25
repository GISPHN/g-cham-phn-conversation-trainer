import { Persona, Scenario } from "../domain/types";

export type PersonaSessionMemory = Record<string, string>;

export type PersonaDetailRequest = {
  key: string;
  label: string;
};

const compact = (text: string) => text.replace(/\s+/g, "");

function detailDimension(text: string): string {
  const t = compact(text);
  if (/どんな|どのような|何を|種類|具体的|詳しく|詳しい|料理名|メニュー|献立|中身|内容/.test(t)) return "items";
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
    /どんな|どのような|何を|具体的|種類|詳しく|詳しい|料理名|メニュー|献立|中身|内容|例えば|たとえば|何回|頻度|週に|毎日|何日|どれくらい|どのくらい|量|何皿|何個|何杯|何時|時間帯|いつ/.test(
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

function dietFallback(
  scenario: Scenario,
  request: PersonaDetailRequest
): string {
  const p = scenario.persona;
  const diet = p.diet || "";
  const key = request.key;
  const seed = `${p.id}:${key}`;

  if (key.startsWith("diet.breakfast.items")) {
    if (/パン|トースト/.test(diet)) {
      return "朝はトーストに卵やヨーグルトを合わせることが多いです。野菜は毎朝ではありません。";
    }
    if (/米飯|ご飯|米/.test(diet)) {
      return pickStable(seed, [
        "朝はご飯と味噌汁に、卵や納豆を付けることが多いです。野菜は毎朝ではありません。",
        "朝はご飯を中心に、味噌汁と卵料理などで簡単に済ませることが多いです。野菜は食べない日もあります。",
      ]);
    }
    return pickStable(seed, [
      "朝はご飯かパンに、卵などを合わせて簡単に済ませることが多いです。",
      "朝は主食と卵料理など、家にあるもので簡単に食べることが多いです。",
    ]);
  }

  if (key.startsWith("diet.lunch.items")) {
    if (/弁当|惣菜|調理済み/.test(diet)) {
      return pickStable(seed, [
        "昼は弁当を買ったり、おにぎりと惣菜で済ませたりすることが多いです。忙しい日は麺類だけのこともあります。",
        "昼はスーパーやコンビニの弁当や惣菜を選ぶことがあります。ご飯ものが中心で、野菜は付いていれば食べる程度です。",
      ]);
    }
    if (/外食/.test(diet)) {
      return pickStable(seed, [
        "昼は外で定食や丼物を食べることが多いです。時間がない日は麺類で済ませることもあります。",
        "昼は外食で、ご飯ものや麺類を選ぶことが多いです。野菜は定食の小鉢やサラダがあれば食べます。",
      ]);
    }
    return "昼はご飯ものを中心に、簡単なおかずを合わせて食べることが多いです。";
  }

  if (key.startsWith("diet.dinner.items")) {
    if (/家庭|自宅|家で/.test(diet)) {
      return pickStable(seed, [
        "夕食は家で、ご飯に肉か魚のおかずと、野菜の副菜を合わせることが多いです。忙しい日は麺類で済ませることもあります。",
        "夜は家で食べることが多く、ご飯と主菜に、作れる時は野菜のおかずを一品付けています。",
      ]);
    }
    return "夕食はご飯や麺類に、肉か魚のおかずを合わせることが多いです。";
  }

  if (key.startsWith("diet.vegetables.items")) {
    return pickStable(seed, [
      "野菜はキャベツやレタス、トマトなどを食べることが多いです。煮物や味噌汁に入っていれば食べることもあります。",
      "野菜はサラダに入っている葉物やトマト、家では青菜や根菜を食べることがあります。",
    ]);
  }

  if (key.startsWith("diet.fruit.items")) {
    return "果物はバナナやみかんなど、手軽に食べられるものを選ぶことがあります。毎日ではありません。";
  }

  if (key.startsWith("diet.meat.items")) {
    return "肉は鶏肉や豚肉のおかずを食べることが多いです。焼いたものや炒め物が多いと思います。";
  }

  if (key.startsWith("diet.fish.items")) {
    return "魚は焼き魚や煮魚を食べることがありますが、肉料理より回数は少ないです。";
  }

  if (key.startsWith("diet.staple.items")) {
    if (/麺/.test(diet) && /米|ご飯|米飯/.test(diet)) {
      return "主食はご飯の日と麺類の日があります。ご飯の方がやや多いと思います。";
    }
    if (/麺/.test(diet)) return "主食は麺類を選ぶことが多いです。";
    if (/米|ご飯|米飯/.test(diet)) return "主食はご飯を食べることが多いです。";
  }

  if (key.startsWith("diet.snack.items")) {
    return "間食はお菓子や甘いものを少し食べることがありますが、毎日ではありません。";
  }

  if (key.startsWith("diet.eatingout.items")) {
    return "外食では定食や丼物、麺類を選ぶことが多いです。手早く食べられるものを選びがちです。";
  }

  if (key.endsWith(".frequency")) {
    if (/多い|よく|中心/.test(diet)) {
      return `${request.label}は週の半分以上はそのような食べ方になることが多いです。`;
    }
    if (/時々|ことがある|日がある/.test(diet)) {
      return `${request.label}は週に何度かそうなる感じです。`;
    }
    return `${request.label}は毎日ではなく、日によって変わります。`;
  }

  if (key.endsWith(".amount")) {
    return `${request.label}の量は特に計っていませんが、食べる時は一人分くらいだと思います。`;
  }

  if (key.endsWith(".time")) {
    if (key.includes("breakfast")) return "朝食は朝の支度をしながら、7時台に食べることが多いです。";
    if (key.includes("lunch")) return "昼食は仕事の日は12時台に食べることが多いです。";
    if (key.includes("dinner")) return "夕食は帰宅後になるので、20時前後になることがあります。";
  }

  return `${request.label}については、普段の生活では決まった一つのパターンではありませんが、今お話ししたような内容になることが多いです。`;
}

export function generatePersonaConsistentFallbackDetail(
  scenario: Scenario,
  request: PersonaDetailRequest,
  memory: PersonaSessionMemory
): string {
  if (request.key.startsWith("diet.")) {
    return dietFallback(scenario, request);
  }

  const p = scenario.persona;
  if (request.key.startsWith("exercise.")) {
    if (/少ない|なし|不足|ほとんど/.test(p.exercise)) {
      return "運動として時間を取ることはあまりなく、通勤や買い物で歩く程度です。";
    }
    return `普段は${p.exercise}という感じで、できる範囲で体を動かしています。`;
  }

  if (request.key.startsWith("sleep.")) {
    return `睡眠は${p.sleep}という感じで、寝る時間や起きる時間は日によって多少変わります。`;
  }

  if (request.key.startsWith("alcohol.")) {
    return `お酒は${p.alcohol}という感じです。飲む日は夕食の時が多いです。`;
  }

  if (request.key.startsWith("work.")) {
    return `${p.occupation}の仕事をしていて、勤務日は仕事の予定に生活時間が左右されることがあります。`;
  }

  const existing = memory[request.key];
  return existing ?? `${request.label}については、普段の生活に合わせてその都度決めています。`;
}
