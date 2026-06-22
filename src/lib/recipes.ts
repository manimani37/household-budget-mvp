import { getActiveIngredients, getIngredientExpiryDays } from "@/lib/calculations";
import {
  areCompatibleIngredients,
  getCanonicalIngredient,
  getIngredientTags,
  mergeIngredientDictionaries,
} from "@/lib/ingredients";
import type { IngredientRecognition } from "@/lib/ingredients";
import type {
  Ingredient,
  IngredientDictionaryItem,
  RecipeRating,
  UserRecipe,
} from "@/types/domain";

export type RecipeSuggestion = {
  id: string;
  title: string;
  subtitle: string;
  usedIngredients: string[];
  missingIngredients: string[];
  usesExpiringIngredient: boolean;
  easeLevel: RecipeRating;
  savingLevel: RecipeRating;
  cookingTimeMinutes: number;
  genre: string;
  reason: string;
  steps: string[];
  source: "builtin" | "user";
  score: number;
};

export type RecipeSuggestionGroups = {
  all: RecipeSuggestion[];
  today: RecipeSuggestion[];
  expiring: RecipeSuggestion[];
  pantryOnly: RecipeSuggestion[];
  oneMissing: RecipeSuggestion[];
  userRecipes: RecipeSuggestion[];
};

type RecipeDefinition = {
  id: string;
  title: string;
  subtitle: string;
  requiredIngredients: string[];
  optionalIngredients: string[];
  steps: string[];
  cookingTimeMinutes: number;
  genre: string;
  easeLevel: RecipeRating;
  savingLevel: RecipeRating;
  source: "builtin" | "user";
};

type StockIngredient = {
  ingredient: Ingredient;
  recognition: IngredientRecognition;
  expiryDays: number | null;
};

type IngredientMatch = {
  requestedName: string;
  stock: StockIngredient;
};

const builtinRecipes: RecipeDefinition[] = [
  {
    id: "builtin-tkg",
    title: "卵かけご飯",
    subtitle: "卵とご飯があればすぐ作れる節約ごはん",
    requiredIngredients: ["卵", "ご飯"],
    optionalIngredients: ["ねぎ", "チーズ"],
    steps: ["ご飯を器に盛る", "卵をのせ、醤油など家にある調味料で整える", "ねぎがあれば散らす"],
    cookingTimeMinutes: 5,
    genre: "朝食",
    easeLevel: 5,
    savingLevel: 5,
    source: "builtin",
  },
  {
    id: "builtin-negi-egg",
    title: "ねぎ卵炒め",
    subtitle: "表記ゆれした卵とねぎも組み合わせて見つけます",
    requiredIngredients: ["卵", "ねぎ"],
    optionalIngredients: ["ご飯", "チーズ", "ハム"],
    steps: ["ねぎを食べやすく切る", "卵を溶いて、ねぎと一緒に手早く炒める", "塩こしょうや醤油で味を整える"],
    cookingTimeMinutes: 10,
    genre: "炒め物",
    easeLevel: 5,
    savingLevel: 4,
    source: "builtin",
  },
  {
    id: "builtin-miso-soup",
    title: "豆腐とねぎの味噌汁",
    subtitle: "期限が近い豆腐やねぎをまとめて使える定番",
    requiredIngredients: ["豆腐", "ねぎ", "味噌"],
    optionalIngredients: ["きのこ", "卵", "ご飯"],
    steps: ["豆腐とねぎを食べやすい大きさにする", "だしや水で具材を温める", "最後に味噌を溶く"],
    cookingTimeMinutes: 12,
    genre: "和食",
    easeLevel: 4,
    savingLevel: 5,
    source: "builtin",
  },
  {
    id: "builtin-oyakodon",
    title: "親子丼",
    subtitle: "鶏肉、卵、玉ねぎがある日の満足度高めの丼",
    requiredIngredients: ["鶏肉", "卵", "玉ねぎ", "ご飯"],
    optionalIngredients: ["ねぎ", "きのこ"],
    steps: ["鶏肉と玉ねぎを薄めの味付けで煮る", "溶き卵を回し入れて半熟で止める", "ご飯にのせ、ねぎがあれば足す"],
    cookingTimeMinutes: 18,
    genre: "丼",
    easeLevel: 4,
    savingLevel: 4,
    source: "builtin",
  },
  {
    id: "builtin-fried-rice",
    title: "卵チャーハン",
    subtitle: "ご飯と卵に、少し余った具材を足して作れます",
    requiredIngredients: ["ご飯", "卵"],
    optionalIngredients: ["ねぎ", "ハム", "ベーコン", "玉ねぎ"],
    steps: ["卵とご飯を強めの火で炒める", "手持ちの具材を細かく切って加える", "醤油や塩こしょうで味を整える"],
    cookingTimeMinutes: 12,
    genre: "炒め物",
    easeLevel: 5,
    savingLevel: 5,
    source: "builtin",
  },
  {
    id: "builtin-pork-sprouts",
    title: "豚肉ともやしの節約炒め",
    subtitle: "安い食材でかさ増ししやすく、期限消費にも向きます",
    requiredIngredients: ["豚肉", "もやし"],
    optionalIngredients: ["ねぎ", "キャベツ", "卵"],
    steps: ["豚肉を先に炒める", "もやしや野菜を加えて短時間で火を通す", "醤油、味噌、塩こしょうなどでまとめる"],
    cookingTimeMinutes: 12,
    genre: "節約料理",
    easeLevel: 5,
    savingLevel: 5,
    source: "builtin",
  },
  {
    id: "builtin-vegetable-soup",
    title: "冷蔵庫整理スープ",
    subtitle: "期限が近い野菜を煮込んで一度に使えます",
    requiredIngredients: ["玉ねぎ", "にんじん"],
    optionalIngredients: ["キャベツ", "じゃがいも", "ベーコン", "きのこ", "トマト"],
    steps: ["野菜を小さめに切る", "水と家にある調味料でやわらかくなるまで煮る", "余ったご飯や卵を足してもよい"],
    cookingTimeMinutes: 20,
    genre: "スープ",
    easeLevel: 4,
    savingLevel: 4,
    source: "builtin",
  },
  {
    id: "builtin-meat-vegetable",
    title: "肉野菜炒め",
    subtitle: "肉系の食材と野菜をまとめる使い切り案",
    requiredIngredients: ["肉", "キャベツ"],
    optionalIngredients: ["もやし", "玉ねぎ", "にんじん", "ねぎ", "卵"],
    steps: ["肉を先に炒める", "火が通りにくい野菜から加える", "醤油、味噌、ポン酢などで味を決める"],
    cookingTimeMinutes: 15,
    genre: "炒め物",
    easeLevel: 4,
    savingLevel: 4,
    source: "builtin",
  },
  {
    id: "builtin-cheese-omelette",
    title: "チーズオムレツ",
    subtitle: "卵に乳製品や加工肉を合わせる簡単メニュー",
    requiredIngredients: ["卵", "チーズ"],
    optionalIngredients: ["玉ねぎ", "ハム", "ベーコン", "トマト"],
    steps: ["卵を溶き、チーズを混ぜる", "あれば刻んだ具材を先に炒める", "卵を流してふんわり火を通す"],
    cookingTimeMinutes: 10,
    genre: "朝食",
    easeLevel: 5,
    savingLevel: 4,
    source: "builtin",
  },
];

export function buildRecipeSuggestions(
  ingredients: Ingredient[],
  userRecipes: UserRecipe[] = [],
  userIngredientDictionary: IngredientDictionaryItem[] = [],
): RecipeSuggestionGroups {
  const dictionary = mergeIngredientDictionaries(userIngredientDictionary);
  const stock = getActiveIngredients(ingredients).map((ingredient) => ({
    ingredient,
    recognition: getCanonicalIngredient(ingredient.name, dictionary),
    expiryDays: getIngredientExpiryDays(ingredient),
  }));
  const recipes = [...builtinRecipes, ...userRecipes.map(toUserRecipeDefinition)];
  const suggestions = recipes
    .map((recipe) => buildSuggestion(recipe, stock, dictionary))
    .filter((suggestion) => suggestion.usedIngredients.length > 0)
    .sort((a, b) => b.score - a.score || a.cookingTimeMinutes - b.cookingTimeMinutes);

  return groupSuggestions(suggestions.length > 0 ? suggestions : buildFallbackSuggestions(stock));
}

function toUserRecipeDefinition(recipe: UserRecipe): RecipeDefinition {
  return {
    id: recipe.id,
    title: recipe.name,
    subtitle: recipe.notes || "自分で追加したレシピ",
    requiredIngredients: recipe.requiredIngredients,
    optionalIngredients: recipe.optionalIngredients,
    steps: recipe.notes
      ? recipe.notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : [`${recipe.requiredIngredients.join("、")}を使って作る`],
    cookingTimeMinutes: recipe.cookingTimeMinutes,
    genre: recipe.genre || "自作",
    easeLevel: recipe.easeLevel,
    savingLevel: recipe.savingLevel,
    source: "user",
  };
}

function buildSuggestion(
  recipe: RecipeDefinition,
  stock: StockIngredient[],
  dictionary: IngredientDictionaryItem[],
): RecipeSuggestion {
  const usedStockIds = new Set<string>();
  const requiredMatches = matchRecipeIngredients(recipe.requiredIngredients, stock, usedStockIds, dictionary);
  const optionalMatches = matchRecipeIngredients(recipe.optionalIngredients, stock, usedStockIds, dictionary);
  const matches = [...requiredMatches.matches, ...optionalMatches.matches];
  const usedIngredients = unique(matches.map((match) => match.stock.ingredient.name));
  const missingIngredients = unique(requiredMatches.missing);
  const usesExpiringIngredient = matches.some(
    (match) => match.stock.expiryDays !== null && match.stock.expiryDays <= 5,
  );
  const compatibilityScore = countCompatiblePairs(matches, dictionary);
  const tagScore = countUsefulTags(matches, dictionary);
  const canCookWithStock = missingIngredients.length === 0;
  const oneMissing = missingIngredients.length === 1;
  const score =
    usedIngredients.length * 12 +
    requiredMatches.matches.length * 8 +
    optionalMatches.matches.length * 4 +
    compatibilityScore * 7 +
    tagScore * 4 +
    recipe.easeLevel * 3 +
    recipe.savingLevel * 3 +
    (usesExpiringIngredient ? 20 : 0) +
    (canCookWithStock ? 25 : 0) +
    (oneMissing ? 12 : 0) -
    missingIngredients.length * 18 -
    recipe.cookingTimeMinutes / 5;

  return {
    id: recipe.id,
    title: recipe.title,
    subtitle: recipe.subtitle,
    usedIngredients,
    missingIngredients,
    usesExpiringIngredient,
    easeLevel: recipe.easeLevel,
    savingLevel: recipe.savingLevel,
    cookingTimeMinutes: recipe.cookingTimeMinutes,
    genre: recipe.genre,
    reason: buildReason({
      usedCount: usedIngredients.length,
      missingIngredients,
      usesExpiringIngredient,
      compatibilityScore,
      tagScore,
      easeLevel: recipe.easeLevel,
      savingLevel: recipe.savingLevel,
      source: recipe.source,
    }),
    steps: recipe.steps,
    source: recipe.source,
    score,
  };
}

function matchRecipeIngredients(
  names: string[],
  stock: StockIngredient[],
  usedStockIds: Set<string>,
  dictionary: IngredientDictionaryItem[],
): { matches: IngredientMatch[]; missing: string[] } {
  const matches: IngredientMatch[] = [];
  const missing: string[] = [];

  names.forEach((name) => {
    const match = stock.find((candidate) => {
      return !usedStockIds.has(candidate.ingredient.id) && matchesRecipeIngredient(name, candidate, dictionary);
    });

    if (!match) {
      missing.push(name);
      return;
    }

    usedStockIds.add(match.ingredient.id);
    matches.push({ requestedName: name, stock: match });
  });

  return { matches, missing };
}

function matchesRecipeIngredient(
  name: string,
  stock: StockIngredient,
  dictionary: IngredientDictionaryItem[],
): boolean {
  const target = getCanonicalIngredient(name, dictionary);

  if (target.dictionaryId && target.dictionaryId === stock.recognition.dictionaryId) {
    return true;
  }

  if (target.canonicalName === "肉" && stock.recognition.category === "肉・魚") {
    return true;
  }

  if (target.groupId && target.groupId === stock.recognition.groupId) {
    return true;
  }

  if (target.normalizedName.length < 2 || stock.recognition.normalizedName.length < 2) {
    return false;
  }

  return (
    stock.recognition.normalizedName.includes(target.normalizedName) ||
    target.normalizedName.includes(stock.recognition.normalizedName)
  );
}

function buildReason({
  usedCount,
  missingIngredients,
  usesExpiringIngredient,
  compatibilityScore,
  tagScore,
  easeLevel,
  savingLevel,
  source,
}: {
  usedCount: number;
  missingIngredients: string[];
  usesExpiringIngredient: boolean;
  compatibilityScore: number;
  tagScore: number;
  easeLevel: RecipeRating;
  savingLevel: RecipeRating;
  source: RecipeSuggestion["source"];
}): string {
  const reasons: string[] = [];

  if (usesExpiringIngredient) {
    reasons.push("期限が近い食材を使える");
  }

  if (missingIngredients.length === 0) {
    reasons.push("手持ち食材だけで作れる");
  } else if (missingIngredients.length === 1) {
    reasons.push(`あと「${missingIngredients[0]}」を買えば作れる`);
  }

  if (compatibilityScore > 0) {
    reasons.push("食材辞書で相性の良い組み合わせが見つかった");
  }

  if (tagScore > 0) {
    reasons.push("簡単・節約向きの食材タグが合っている");
  }

  if (usedCount >= 3) {
    reasons.push("使える手持ち食材が多い");
  }

  if (easeLevel >= 4) {
    reasons.push("短時間で作りやすい");
  }

  if (savingLevel >= 4) {
    reasons.push("買い足しが少なく食費を抑えやすい");
  }

  if (source === "user") {
    reasons.push("自分で追加したレシピも条件に合っている");
  }

  return reasons.length > 0 ? reasons.join(" / ") : "登録食材と必要食材が近い";
}

function countCompatiblePairs(
  matches: IngredientMatch[],
  dictionary: IngredientDictionaryItem[],
): number {
  let score = 0;

  for (let index = 0; index < matches.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < matches.length; nextIndex += 1) {
      if (
        areCompatibleIngredients(
          matches[index].stock.recognition.canonicalName,
          matches[nextIndex].stock.recognition.canonicalName,
          dictionary,
        )
      ) {
        score += 1;
      }
    }
  }

  return score;
}

function countUsefulTags(
  matches: IngredientMatch[],
  dictionary: IngredientDictionaryItem[],
): number {
  const tags = unique(
    matches.flatMap((match) => getIngredientTags(match.stock.recognition.canonicalName, dictionary)),
  );

  return tags.filter((tag) => tag === "簡単" || tag === "節約" || tag === "常備").length;
}

function groupSuggestions(suggestions: RecipeSuggestion[]): RecipeSuggestionGroups {
  const limited = suggestions.slice(0, 12);

  return {
    all: limited,
    today: limited.slice(0, 4),
    expiring: limited.filter((recipe) => recipe.usesExpiringIngredient).slice(0, 6),
    pantryOnly: limited.filter((recipe) => recipe.missingIngredients.length === 0).slice(0, 6),
    oneMissing: limited.filter((recipe) => recipe.missingIngredients.length === 1).slice(0, 6),
    userRecipes: suggestions.filter((recipe) => recipe.source === "user").slice(0, 8),
  };
}

function buildFallbackSuggestions(stock: StockIngredient[]): RecipeSuggestion[] {
  const fallbackIngredients = stock.slice(0, 4);
  if (fallbackIngredients.length === 0) {
    return [];
  }

  const usedIngredients = fallbackIngredients.map((item) => item.ingredient.name);

  return [
    {
      id: "fallback-use-up",
      title: "ストック使い切り炒め",
      subtitle: "登録食材から作る汎用の簡単案",
      usedIngredients,
      missingIngredients: [],
      usesExpiringIngredient: fallbackIngredients.some(
        (item) => item.expiryDays !== null && item.expiryDays <= 5,
      ),
      easeLevel: 4,
      savingLevel: 4,
      cookingTimeMinutes: 15,
      genre: "簡単料理",
      reason: "手持ち食材を優先して、買い足しなしで消費しやすい",
      steps: [
        `${usedIngredients.join("、")}を食べやすい大きさにする`,
        "火が通りにくいものから順に加熱する",
        "塩、醤油、味噌、ポン酢など家にある調味料でまとめる",
      ],
      source: "builtin",
      score: 30,
    },
  ];
}

function unique(values: string[]): string[] {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}
