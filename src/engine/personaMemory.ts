import { Persona, Scenario } from "../domain/types";

export type PersonaSessionMemory = Record<string, string>;

export type PersonaDetailDimension =
  | "presence"
  | "items"
  | "frequency"
  | "amount"
  | "time"
  | "detail";

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
  | "protein";

export type PersonaDetailRequest = {
  key: string;
  label: string;
  dimension: PersonaDetailDimension;
  meal?: PersonaMealContext;
  food?: PersonaFoodContext;
  isCorrection?: boolean;
  queryText?: string;
};

const compact = (text: string) => text.replace(/\s+/g, "");

function correctionFocus(text: string): string {
  const compacted = compact(text);
  const markers = ["ではなく", "じゃなく", "そうではなく", "聞きたいのは"];
  let focus = compacted;
  for (const marker of markers) {
    const index = focus.lastIndexOf(marker);
    if (index >= 0) focus = focus.slice(index + marker.length);
  }
  return focus;
}

function detailDimension(text: string): PersonaDetailDimension {
  const t = compact(text);
  if (/どれくらい|どのくらい|量|何皿|何個|何杯|何グラム|何g|どの程度/.test(t)) return "amount";
  if (/何回|頻度|週に|1週間|一週間|毎日|何日|何度/.test(t)) return "frequency";
  if (/何時|時間帯|いつ食べ|何時頃|何時ぐらい/.test(t)) return "time";
  if (/どんな|どのような|何を|種類|具体的|詳しく|詳しい|料理名|メニュー|献立|中身|内容/.test(t)) return "items";
  if (/(食べていますか|食べますか|摂っていますか|取っていますか|ありますか|していますか)[？?]?$/.test(t)) return "presence";
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
  if (/うどん|そば|蕎麦|ラーメン|パスタ|スパゲッティ|焼きそば|そうめん|素麺|麺類|麺/.test(t)) return "noodles";
  if (/肉|肉料理/.test(t)) return "meat";
  if (/魚|魚料理/.test(t)) return "fish";
  if (/パン|食パン|トースト/.test(t)) return "bread";
  if (/ご飯|米飯|白米|玄米|米/.test(t)) return "rice";
  if (/主食/.test(t)) return "staple";
  if (/間食|お菓子|菓子|おやつ/.test(t)) return "snack";
  if (/外食|惣菜|弁当/.test(t)) return "eatingout";
  if (/たんぱく|タンパク|蛋白/.test(t)) return "protein";
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
};

function buildDetailKey(
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

function buildDetailLabel(
  meal: PersonaMealContext | undefined,
  food: PersonaFoodContext | undefined
): string {
  if (meal && food) return `${mealLabels[meal]}時の${foodLabels[food]}`;
  if (meal) return mealLabels[meal];
  if (food) return foodLabels[food];
  return "食生活";
}

export function detectPersonaDetailRequest(
  text: string,
  previous?: PersonaDetailRequest | null
): PersonaDetailRequest | null {
  const original = compact(text);
  const isCorrection =
    /ではなく|じゃなく|違います|違う|そうではなく|聞いています|聞きたいのは/.test(original);
  const focus = isCorrection ? correctionFocus(text) : original;
  const dimension = detailDimension(focus);

  let meal = detectMeal(focus);
  let food = detectFood(focus);

  const followupCue =
    /^(その|それ|では|じゃあ|ちなみに|どれくらい|どのくらい|量は|何日|何回)/.test(focus) ||
    dimension !== "detail";

  if (previous && followupCue && !isCorrection) {
    if (!meal && previous.meal) meal = previous.meal;
    if (!food && previous.food) food = previous.food;
  }

  const hasDietContext =
    Boolean(meal || food) ||
    /食事|食べ|摂|取/.test(focus) ||
    Boolean(previous && followupCue);

  if (!hasDietContext) return null;

  const explicitDetail =
    dimension !== "detail" ||
    isCorrection ||
    Boolean(meal && food) ||
    /具体的|詳しく|どのよう|どんな|どれくらい|どのくらい/.test(focus);

  if (!explicitDetail) return null;

  const resolvedDimension =
    dimension === "detail" && meal && food ? "presence" : dimension;

  return {
    key: buildDetailKey(meal, food, resolvedDimension),
    label: buildDetailLabel(meal, food),
    dimension: resolvedDimension,
    meal,
    food,
    isCorrection,
    queryText: text,
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


export function isPersonaDetailAnswerValid(
  request: PersonaDetailRequest,
  answer: string
): boolean {
  const text = compact(answer);
  if (!text) return false;

  if (request.dimension === "amount") {
    const hasAmount =
      /[0-9０-９一二三四五六七八九十]+(?:皿|個|杯|g|グラム|割|品|人分)|小鉢|片手|両手|ひとつかみ|一人分|半分|少なめ|多め/.test(
        text
      );
    return hasAmount;
  }

  if (request.dimension === "frequency") {
    return /週|毎日|日くらい|回くらい|何度か|ほぼ毎日|時々/.test(text);
  }

  if (request.dimension === "time") {
    return /[0-9０-９一二三四五六七八九十]+時|朝|昼|夕方|夜|帰宅後|起床後/.test(text);
  }

  if (request.dimension === "items") {
    if (request.food === "vegetables") {
      return /キャベツ|レタス|トマト|青菜|根菜|サラダ|煮物|おひたし|味噌汁|野菜/.test(text);
    }
    if (request.food === "noodles") {
      return /うどん|そば|蕎麦|ラーメン|パスタ|焼きそば|そうめん|麺/.test(text);
    }
    return text.length >= 8;
  }

  if (request.dimension === "presence") {
    return /はい|いいえ|食べて|食べます|食べません|摂って|取って|あります|ありません/.test(text);
  }

  return text.length >= 4;
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
      `${mealPrefix}野菜は副菜を1品食べるくらいです。量としては小鉢1皿くらいだと思います。`,
    ]);
  }

  if (request.food === "vegetables" && request.dimension === "items") {
    const mealPrefix = request.meal ? `${mealLabels[request.meal]}では、` : "";
    return pickStable(seed, [
      `${mealPrefix}キャベツやレタス、トマトなどをサラダで食べることがあります。あとは味噌汁に野菜が入っていることもあります。`,
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

  if (key.startsWith("diet.noodles.items")) {
    return pickStable(seed, [
      "麺類なら、うどんやそばを食べることが多いです。時間がない時はラーメンや焼きそばで済ませることもあります。",
      "麺類はうどん、そば、ラーメンあたりが多いです。昼に手早く済ませたい時に選ぶことがあります。",
      "昼に麺類を食べる時は、うどんやそば、時々ラーメンを選びます。",
    ]);
  }

  if (key.startsWith("diet.bread.items")) {
    return "パンなら食パンやロールパンを食べることが多いです。朝に簡単に済ませたい時に選びます。";
  }

  if (key.startsWith("diet.rice.items")) {
    return "ご飯は白いご飯を食べることが多く、丼物や弁当のご飯として食べることもあります。";
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
    if (key.startsWith("diet.vegetables")) {
      return pickStable(seed, [
        "野菜は週に5日くらいは食べています。ほとんど食べない日は週に2日くらいあります。",
        "野菜は週に4日くらいは食べています。十分に取れない日は週に3日くらいあります。",
      ]);
    }
    if (/多い|よく|中心/.test(diet)) {
      return `${request.label}は週に4〜5日くらいそうなることがあります。`;
    }
    if (/時々|ことがある|日がある/.test(diet)) {
      return `${request.label}は週に2〜3回くらいです。`;
    }
    return `${request.label}は毎日ではなく、週に何度かです。`;
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
    return dietFallback(scenario, request, memory);
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


function parseJapaneseDigit(value: string): number | null {
  const normalized = value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const map: Record<string, number> = {
    一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7,
  };
  return map[value] ?? null;
}

function extractCurrentVegetableDays(memory: PersonaSessionMemory): number | null {
  const candidates = Object.entries(memory)
    .filter(([key]) => key.startsWith("diet.vegetables"))
    .map(([, value]) => value);

  for (const text of candidates) {
    // Negative-day expressions must be interpreted first:
    // "野菜を食べない日は週2日" means eating vegetables about 5 days/week.
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
    const targetMatch = t.match(/週(?:に)?([0-7一二三四五六七])日/);
    if (currentDays !== null && targetMatch) {
      const target = parseJapaneseDigit(targetMatch[1]);
      if (target !== null && /食べる日/.test(t) && target < currentDays) {
        return `今のお話だと、野菜を食べる日は週に${currentDays}日くらいあります。週${target}日にするという意味だと、今より減ることになると思うのですが、週${currentDays + 1 > 7 ? 7 : currentDays + 1}日くらいに増やすという意味でしょうか。`;
      }
    }
  }

  return null;
}
