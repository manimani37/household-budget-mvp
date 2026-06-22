import { getActiveIngredients, getIngredientExpiryDays } from "@/lib/calculations";
import type {
  Ingredient,
  RecipeRating,
  StorageLocation,
  UserRecipe,
} from "@/types/domain";

export type IngredientDictionaryEntry = {
  id: string;
  canonicalName: string;
  aliases: string[];
  category: string;
  compatibleIngredients: string[];
  commonGenres: string[];
  defaultStorageLocation: StorageLocation;
  estimatedExpiryDays: number;
};

export type IngredientRecognition = {
  originalName: string;
  normalizedName: string;
  canonicalName: string;
  category: string;
  dictionaryId: string | null;
  defaultStorageLocation: StorageLocation;
  estimatedExpiryDays: number | null;
};

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

export const ingredientDictionary: IngredientDictionaryEntry[] = [
  {
    id: "egg",
    canonicalName: "卵",
    aliases: ["たまご", "玉子", "玉子", "egg", "eggs"],
    category: "卵・乳製品",
    compatibleIngredients: ["ねぎ", "玉ねぎ", "ベーコン", "ハム", "ご飯", "チーズ"],
    commonGenres: ["朝食", "丼", "炒め物", "簡単料理"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 14,
  },
  {
    id: "negi",
    canonicalName: "ねぎ",
    aliases: ["ネギ", "青ねぎ", "白ねぎ", "長ねぎ", "長ネギ", "葱", "green onion", "scallion"],
    category: "野菜",
    compatibleIngredients: ["卵", "豆腐", "豚肉", "鶏肉", "ご飯", "味噌"],
    commonGenres: ["和食", "炒め物", "スープ"],
    defaultStorageLocation: "vegetable_room",
    estimatedExpiryDays: 7,
  },
  {
    id: "onion",
    canonicalName: "玉ねぎ",
    aliases: ["玉葱", "たまねぎ", "タマネギ", "onion"],
    category: "野菜",
    compatibleIngredients: ["卵", "鶏肉", "豚肉", "牛肉", "じゃがいも", "チーズ"],
    commonGenres: ["炒め物", "スープ", "丼", "洋食"],
    defaultStorageLocation: "room",
    estimatedExpiryDays: 21,
  },
  {
    id: "rice",
    canonicalName: "ご飯",
    aliases: ["ごはん", "御飯", "白米", "米", "ライス", "rice"],
    category: "主食",
    compatibleIngredients: ["卵", "ねぎ", "豚肉", "鶏肉", "ハム", "味噌"],
    commonGenres: ["丼", "朝食", "炒め物", "和食"],
    defaultStorageLocation: "room",
    estimatedExpiryDays: 30,
  },
  {
    id: "pork",
    canonicalName: "豚肉",
    aliases: ["豚", "ぶた肉", "豚こま", "豚バラ", "pork"],
    category: "肉・魚",
    compatibleIngredients: ["ねぎ", "玉ねぎ", "もやし", "キャベツ", "味噌", "ご飯"],
    commonGenres: ["炒め物", "丼", "和食", "節約料理"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 3,
  },
  {
    id: "chicken",
    canonicalName: "鶏肉",
    aliases: ["鶏", "とり肉", "鳥肉", "チキン", "chicken"],
    category: "肉・魚",
    compatibleIngredients: ["卵", "玉ねぎ", "ねぎ", "ご飯", "じゃがいも"],
    commonGenres: ["丼", "炒め物", "和食", "洋食"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 3,
  },
  {
    id: "beef",
    canonicalName: "牛肉",
    aliases: ["牛", "ぎゅう肉", "ビーフ", "beef"],
    category: "肉・魚",
    compatibleIngredients: ["玉ねぎ", "ご飯", "じゃがいも", "ねぎ"],
    commonGenres: ["丼", "炒め物", "洋食"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 3,
  },
  {
    id: "meat",
    canonicalName: "肉",
    aliases: ["肉類", "meat"],
    category: "肉・魚",
    compatibleIngredients: ["ねぎ", "玉ねぎ", "キャベツ", "もやし", "ご飯"],
    commonGenres: ["炒め物", "丼", "節約料理"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 3,
  },
  {
    id: "bacon",
    canonicalName: "ベーコン",
    aliases: ["bacon"],
    category: "加工食品",
    compatibleIngredients: ["卵", "チーズ", "玉ねぎ", "キャベツ", "トマト"],
    commonGenres: ["朝食", "洋食", "スープ"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 7,
  },
  {
    id: "ham",
    canonicalName: "ハム",
    aliases: ["ham", "ロースハム"],
    category: "加工食品",
    compatibleIngredients: ["卵", "チーズ", "ご飯", "キャベツ"],
    commonGenres: ["朝食", "炒め物", "簡単料理"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 7,
  },
  {
    id: "cheese",
    canonicalName: "チーズ",
    aliases: ["cheese", "スライスチーズ", "ピザ用チーズ"],
    category: "卵・乳製品",
    compatibleIngredients: ["卵", "ベーコン", "ハム", "トマト", "じゃがいも"],
    commonGenres: ["洋食", "朝食", "簡単料理"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 14,
  },
  {
    id: "tofu",
    canonicalName: "豆腐",
    aliases: ["とうふ", "トウフ", "tofu", "絹豆腐", "木綿豆腐"],
    category: "大豆製品",
    compatibleIngredients: ["ねぎ", "味噌", "卵", "豚肉"],
    commonGenres: ["和食", "スープ", "節約料理"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 4,
  },
  {
    id: "miso",
    canonicalName: "味噌",
    aliases: ["みそ", "ミソ", "miso"],
    category: "調味料",
    compatibleIngredients: ["ねぎ", "豆腐", "豚肉", "キャベツ", "ご飯"],
    commonGenres: ["和食", "スープ"],
    defaultStorageLocation: "opened_fridge",
    estimatedExpiryDays: 60,
  },
  {
    id: "cabbage",
    canonicalName: "キャベツ",
    aliases: ["きゃべつ", "cabbage"],
    category: "野菜",
    compatibleIngredients: ["豚肉", "ベーコン", "卵", "もやし", "味噌"],
    commonGenres: ["炒め物", "スープ", "節約料理"],
    defaultStorageLocation: "vegetable_room",
    estimatedExpiryDays: 7,
  },
  {
    id: "carrot",
    canonicalName: "にんじん",
    aliases: ["人参", "ニンジン", "carrot"],
    category: "野菜",
    compatibleIngredients: ["玉ねぎ", "じゃがいも", "鶏肉", "キャベツ"],
    commonGenres: ["スープ", "炒め物", "洋食"],
    defaultStorageLocation: "vegetable_room",
    estimatedExpiryDays: 14,
  },
  {
    id: "potato",
    canonicalName: "じゃがいも",
    aliases: ["じゃが芋", "ジャガイモ", "馬鈴薯", "potato"],
    category: "野菜",
    compatibleIngredients: ["玉ねぎ", "チーズ", "ベーコン", "鶏肉", "にんじん"],
    commonGenres: ["洋食", "スープ", "節約料理"],
    defaultStorageLocation: "room",
    estimatedExpiryDays: 21,
  },
  {
    id: "bean-sprout",
    canonicalName: "もやし",
    aliases: ["モヤシ", "bean sprout", "bean sprouts"],
    category: "野菜",
    compatibleIngredients: ["豚肉", "卵", "ねぎ", "キャベツ"],
    commonGenres: ["炒め物", "節約料理", "簡単料理"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 3,
  },
  {
    id: "mushroom",
    canonicalName: "きのこ",
    aliases: ["キノコ", "しめじ", "しいたけ", "椎茸", "えのき", "舞茸", "mushroom"],
    category: "野菜",
    compatibleIngredients: ["卵", "ご飯", "鶏肉", "玉ねぎ", "味噌"],
    commonGenres: ["和食", "炒め物", "スープ"],
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: 5,
  },
  {
    id: "tomato",
    canonicalName: "トマト",
    aliases: ["とまと", "tomato", "ミニトマト"],
    category: "野菜",
    compatibleIngredients: ["卵", "チーズ", "ベーコン", "玉ねぎ"],
    commonGenres: ["洋食", "スープ", "朝食"],
    defaultStorageLocation: "vegetable_room",
    estimatedExpiryDays: 7,
  },
];

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
): RecipeSuggestionGroups {
  const stock = getActiveIngredients(ingredients).map((ingredient) => ({
    ingredient,
    recognition: recognizeIngredient(ingredient.name),
    expiryDays: getIngredientExpiryDays(ingredient),
  }));
  const recipes = [...builtinRecipes, ...userRecipes.map(toUserRecipeDefinition)];
  const suggestions = recipes
    .map((recipe) => buildSuggestion(recipe, stock))
    .filter((suggestion) => suggestion.usedIngredients.length > 0)
    .sort((a, b) => b.score - a.score || a.cookingTimeMinutes - b.cookingTimeMinutes);

  return groupSuggestions(suggestions.length > 0 ? suggestions : buildFallbackSuggestions(stock));
}

export function recognizeIngredient(name: string): IngredientRecognition {
  const normalizedName = normalizeIngredientName(name);
  const exactMatch = ingredientDictionary.find((entry) =>
    getSearchNames(entry).some((alias) => alias === normalizedName),
  );

  if (exactMatch) {
    return recognitionFromEntry(name, normalizedName, exactMatch);
  }

  const partialMatch = ingredientDictionary
    .flatMap((entry) => getSearchNames(entry).map((alias) => ({ entry, alias })))
    .filter(({ alias }) => alias.length >= 2)
    .sort((a, b) => b.alias.length - a.alias.length)
    .find(({ alias }) => normalizedName.includes(alias) || alias.includes(normalizedName));

  if (partialMatch) {
    return recognitionFromEntry(name, normalizedName, partialMatch.entry);
  }

  return {
    originalName: name,
    normalizedName,
    canonicalName: name.trim(),
    category: inferIngredientCategory(normalizedName),
    dictionaryId: null,
    defaultStorageLocation: "fridge",
    estimatedExpiryDays: null,
  };
}

export function normalizeIngredientName(value: string): string {
  return toHiragana(value.normalize("NFKC").toLowerCase())
    .replace(/[ \t\r\n　・･,、。.\-_/／\\()[\]（）「」『』【】]/g, "")
    .trim();
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

function buildSuggestion(recipe: RecipeDefinition, stock: StockIngredient[]): RecipeSuggestion {
  const usedStockIds = new Set<string>();
  const requiredMatches = matchRecipeIngredients(recipe.requiredIngredients, stock, usedStockIds);
  const optionalMatches = matchRecipeIngredients(recipe.optionalIngredients, stock, usedStockIds);
  const matches = [...requiredMatches.matches, ...optionalMatches.matches];
  const usedIngredients = unique(matches.map((match) => match.stock.ingredient.name));
  const missingIngredients = unique(requiredMatches.missing);
  const usesExpiringIngredient = matches.some(
    (match) => match.stock.expiryDays !== null && match.stock.expiryDays <= 5,
  );
  const compatibilityScore = countCompatiblePairs(matches);
  const canCookWithStock = missingIngredients.length === 0;
  const oneMissing = missingIngredients.length === 1;
  const score =
    usedIngredients.length * 12 +
    requiredMatches.matches.length * 8 +
    optionalMatches.matches.length * 4 +
    compatibilityScore * 7 +
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
): { matches: IngredientMatch[]; missing: string[] } {
  const matches: IngredientMatch[] = [];
  const missing: string[] = [];

  names.forEach((name) => {
    const match = stock.find((candidate) => {
      return !usedStockIds.has(candidate.ingredient.id) && matchesRecipeIngredient(name, candidate);
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

function matchesRecipeIngredient(name: string, stock: StockIngredient): boolean {
  const target = recognizeIngredient(name);

  if (target.dictionaryId && target.dictionaryId === stock.recognition.dictionaryId) {
    return true;
  }

  if (target.canonicalName === "肉" && stock.recognition.category === "肉・魚") {
    return true;
  }

  if (
    target.dictionaryId === null &&
    target.category !== "その他" &&
    target.category === stock.recognition.category
  ) {
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
  easeLevel,
  savingLevel,
  source,
}: {
  usedCount: number;
  missingIngredients: string[];
  usesExpiringIngredient: boolean;
  compatibilityScore: number;
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

function countCompatiblePairs(matches: IngredientMatch[]): number {
  let score = 0;

  for (let index = 0; index < matches.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < matches.length; nextIndex += 1) {
      if (
        areCompatible(
          matches[index].stock.recognition.canonicalName,
          matches[nextIndex].stock.recognition.canonicalName,
        )
      ) {
        score += 1;
      }
    }
  }

  return score;
}

function areCompatible(a: string, b: string): boolean {
  const first = findEntryByCanonical(a);
  const second = findEntryByCanonical(b);

  return Boolean(
    first?.compatibleIngredients.some((name) => normalizeIngredientName(name) === normalizeIngredientName(b)) ||
      second?.compatibleIngredients.some((name) => normalizeIngredientName(name) === normalizeIngredientName(a)),
  );
}

function groupSuggestions(suggestions: RecipeSuggestion[]): RecipeSuggestionGroups {
  const limited = suggestions.slice(0, 12);

  return {
    all: limited,
    today: limited.slice(0, 4),
    expiring: limited.filter((recipe) => recipe.usesExpiringIngredient).slice(0, 6),
    pantryOnly: limited.filter((recipe) => recipe.missingIngredients.length === 0).slice(0, 6),
    oneMissing: limited.filter((recipe) => recipe.missingIngredients.length === 1).slice(0, 6),
    userRecipes: limited.filter((recipe) => recipe.source === "user"),
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

function recognitionFromEntry(
  originalName: string,
  normalizedName: string,
  entry: IngredientDictionaryEntry,
): IngredientRecognition {
  return {
    originalName,
    normalizedName,
    canonicalName: entry.canonicalName,
    category: entry.category,
    dictionaryId: entry.id,
    defaultStorageLocation: entry.defaultStorageLocation,
    estimatedExpiryDays: entry.estimatedExpiryDays,
  };
}

function getSearchNames(entry: IngredientDictionaryEntry): string[] {
  return [entry.canonicalName, ...entry.aliases].map(normalizeIngredientName);
}

function findEntryByCanonical(name: string): IngredientDictionaryEntry | undefined {
  const normalizedName = normalizeIngredientName(name);
  return ingredientDictionary.find(
    (entry) => normalizeIngredientName(entry.canonicalName) === normalizedName,
  );
}

function inferIngredientCategory(normalizedName: string): string {
  if (/(肉|豚|鶏|鳥|牛|魚|鮭|さば|まぐろ|chicken|pork|beef|fish)/.test(normalizedName)) {
    return "肉・魚";
  }
  if (/(卵|たまご|egg|牛乳|乳|チーズ|cheese|ヨーグルト)/.test(normalizedName)) {
    return "卵・乳製品";
  }
  if (/(米|ごはん|ご飯|パン|麺|うどん|そば|パスタ|rice|bread|pasta)/.test(normalizedName)) {
    return "主食";
  }
  if (/(野菜|ねぎ|玉ねぎ|人参|にんじん|芋|キャベツ|トマト|レタス|もやし|きのこ)/.test(normalizedName)) {
    return "野菜";
  }
  if (/(味噌|みそ|醤油|しょうゆ|ソース|塩|砂糖|oil|miso)/.test(normalizedName)) {
    return "調味料";
  }

  return "その他";
}

function toHiragana(value: string): string {
  return value.replace(/[\u30a1-\u30f6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  );
}

function unique(values: string[]): string[] {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}
