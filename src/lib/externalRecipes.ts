import { getIngredientExpiryDays } from "@/lib/calculations";
import {
  getCanonicalIngredient,
  matchIngredients,
  mergeIngredientDictionaries,
  normalizeIngredientName,
} from "@/lib/ingredients";
import type { Ingredient, IngredientDictionaryItem } from "@/types/domain";

export type ExternalIngredientCategory =
  | "egg"
  | "vegetable"
  | "meat"
  | "staple"
  | "soy"
  | "dairy"
  | "seasoning"
  | "other";

export type ExternalRecipeSearchIngredient = {
  name: string;
  canonicalName: string;
  normalizedName: string;
  category: ExternalIngredientCategory;
  expiryDays: number | null;
};

export type RakutenRecipeCategory = {
  categoryId: string;
  categoryName: string;
  categoryUrl?: string;
};

export type RakutenRecipeRankingItem = {
  recipeId: number | string;
  recipeTitle: string;
  recipeUrl: string;
  foodImageUrl?: string;
  mediumImageUrl?: string;
  smallImageUrl?: string;
  recipeDescription?: string;
  recipeMaterial?: string[];
  recipeIndication?: string;
  recipeCost?: string;
  rank?: number | string;
  categoryName?: string;
};

export type ExternalRecipe = {
  recipeId: string;
  recipeTitle: string;
  recipeUrl: string;
  foodImageUrl: string;
  recipeMaterial: string[];
  recipeIndication: string;
  recipeCost: string;
  usedIngredients: string[];
  possibleMissingIngredients: string[];
  reason: string;
  score: number;
  rank: number | null;
  sourceCategoryName: string;
};

const categoryKeywords: Record<ExternalIngredientCategory, string[]> = {
  egg: ["卵", "玉子", "たまご"],
  vegetable: ["野菜", "ねぎ", "玉ねぎ", "キャベツ", "もやし", "きのこ", "トマト"],
  meat: ["肉", "豚肉", "鶏肉", "牛肉", "ベーコン", "ハム"],
  staple: ["ご飯", "米", "丼", "パスタ", "うどん", "そば", "麺"],
  soy: ["豆腐", "大豆"],
  dairy: ["チーズ", "乳", "牛乳"],
  seasoning: ["味噌", "調味料"],
  other: [],
};

const commonPantryKeywords = [
  "水",
  "塩",
  "こしょう",
  "胡椒",
  "砂糖",
  "醤油",
  "しょうゆ",
  "酒",
  "みりん",
  "油",
  "ごま油",
  "酢",
  "だし",
  "ほんだし",
  "コンソメ",
  "ソース",
  "マヨネーズ",
  "ケチャップ",
];

export function buildExternalRecipeSearchIngredients(
  ingredients: Ingredient[],
  userIngredientDictionary: IngredientDictionaryItem[] = [],
): ExternalRecipeSearchIngredient[] {
  const dictionary = mergeIngredientDictionaries(userIngredientDictionary);
  return ingredients
    .filter((ingredient) => ingredient.status === "active")
    .map((ingredient) => {
      const recognition = getCanonicalIngredient(ingredient.name, dictionary);
      return {
        name: ingredient.name,
        canonicalName: recognition.canonicalName,
        normalizedName: recognition.normalizedName,
        category: mapIngredientCategory(recognition.category, recognition.canonicalName),
        expiryDays: getIngredientExpiryDays(ingredient),
      };
    })
    .filter((ingredient, index, array) => {
      return array.findIndex((item) => item.normalizedName === ingredient.normalizedName) === index;
    });
}

export function pickRakutenRecipeCategories(
  categories: RakutenRecipeCategory[],
  ingredients: ExternalRecipeSearchIngredient[],
  limit = 4,
): RakutenRecipeCategory[] {
  const scoredCategories = categories
    .map((category) => ({
      category,
      score: scoreRakutenCategory(category, ingredients),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.category.categoryName.localeCompare(b.category.categoryName, "ja"));

  return scoredCategories.slice(0, limit).map(({ category }) => category);
}

export function scoreExternalRecipes(
  recipes: RakutenRecipeRankingItem[],
  ingredients: ExternalRecipeSearchIngredient[],
  userIngredientDictionary: IngredientDictionaryItem[] = [],
): ExternalRecipe[] {
  const dictionary = mergeIngredientDictionaries(userIngredientDictionary);
  return recipes
    .map((recipe) => scoreExternalRecipe(recipe, ingredients, dictionary))
    .filter((recipe) => recipe.recipeTitle && recipe.recipeUrl)
    .sort((a, b) => b.score - a.score || (a.rank ?? 99) - (b.rank ?? 99));
}

function scoreExternalRecipe(
  recipe: RakutenRecipeRankingItem,
  ingredients: ExternalRecipeSearchIngredient[],
  dictionary: IngredientDictionaryItem[],
): ExternalRecipe {
  const materials = Array.isArray(recipe.recipeMaterial) ? recipe.recipeMaterial.filter(Boolean) : [];
  const usedIngredients = findUsedIngredients(materials, ingredients, dictionary);
  const possibleMissingIngredients = materials
    .filter((material) => !isCommonPantryMaterial(material))
    .filter((material) => !matchesAnyStockIngredient(material, ingredients, dictionary))
    .slice(0, 6);
  const usesExpiringIngredient = ingredients.some(
    (ingredient) =>
      ingredient.expiryDays !== null &&
      ingredient.expiryDays <= 5 &&
      usedIngredients.includes(ingredient.name),
  );
  const minutes = parseRecipeMinutes(recipe.recipeIndication);
  const cost = parseRecipeCost(recipe.recipeCost);
  const rank = normalizeRank(recipe.rank);
  const score =
    usedIngredients.length * 18 +
    (usesExpiringIngredient ? 24 : 0) +
    Math.max(0, 28 - minutes / 2) +
    Math.max(0, 22 - cost / 100) -
    possibleMissingIngredients.length * 7 +
    (rank ? Math.max(0, 8 - rank) : 0);

  return {
    recipeId: String(recipe.recipeId),
    recipeTitle: recipe.recipeTitle,
    recipeUrl: recipe.recipeUrl,
    foodImageUrl: recipe.foodImageUrl || recipe.mediumImageUrl || recipe.smallImageUrl || "",
    recipeMaterial: materials,
    recipeIndication: recipe.recipeIndication || "指定なし",
    recipeCost: recipe.recipeCost || "指定なし",
    usedIngredients,
    possibleMissingIngredients,
    reason: buildExternalRecipeReason({
      usedCount: usedIngredients.length,
      missingCount: possibleMissingIngredients.length,
      usesExpiringIngredient,
      minutes,
      cost,
    }),
    score,
    rank,
    sourceCategoryName: recipe.categoryName || "楽天レシピ",
  };
}

function scoreRakutenCategory(
  category: RakutenRecipeCategory,
  ingredients: ExternalRecipeSearchIngredient[],
): number {
  const normalizedCategoryName = normalizeIngredientName(category.categoryName);
  const categories = ingredients.map((ingredient) => ingredient.category);
  const uniqueCategories = categories.filter((categoryName, index) => categories.indexOf(categoryName) === index);

  return uniqueCategories.reduce((score, ingredientCategory) => {
    const keywords = categoryKeywords[ingredientCategory] ?? [];
    const keywordScore = keywords.some((keyword) =>
      normalizedCategoryName.includes(normalizeIngredientName(keyword)),
    )
      ? 8
      : 0;
    const ingredientNameScore = ingredients.some(
      (ingredient) =>
        ingredient.category === ingredientCategory &&
        normalizedCategoryName.includes(normalizeIngredientName(ingredient.canonicalName)),
    )
      ? 5
      : 0;

    return score + keywordScore + ingredientNameScore;
  }, 0);
}

function mapIngredientCategory(category: string, canonicalName: string): ExternalIngredientCategory {
  if (canonicalName === "卵") {
    return "egg";
  }
  if (category === "野菜") {
    return "vegetable";
  }
  if (category === "肉・魚" || category === "加工食品" || canonicalName === "ベーコン" || canonicalName === "ハム") {
    return "meat";
  }
  if (category === "主食") {
    return "staple";
  }
  if (category === "大豆製品") {
    return "soy";
  }
  if (category === "卵・乳製品") {
    return "dairy";
  }
  if (category === "調味料") {
    return "seasoning";
  }

  return "other";
}

function findUsedIngredients(
  materials: string[],
  ingredients: ExternalRecipeSearchIngredient[],
  dictionary: IngredientDictionaryItem[],
): string[] {
  return ingredients
    .filter((ingredient) => materials.some((material) => matchesMaterial(material, ingredient, dictionary)))
    .map((ingredient) => ingredient.name);
}

function matchesAnyStockIngredient(
  material: string,
  ingredients: ExternalRecipeSearchIngredient[],
  dictionary: IngredientDictionaryItem[],
): boolean {
  return ingredients.some((ingredient) => matchesMaterial(material, ingredient, dictionary));
}

function matchesMaterial(
  material: string,
  ingredient: ExternalRecipeSearchIngredient,
  dictionary: IngredientDictionaryItem[],
): boolean {
  const normalizedMaterial = normalizeIngredientName(material);
  if (!normalizedMaterial || !ingredient.normalizedName) {
    return false;
  }

  if (matchIngredients(material, ingredient.canonicalName, dictionary)) {
    return true;
  }

  return (
    normalizedMaterial.includes(ingredient.normalizedName) ||
    ingredient.normalizedName.includes(normalizedMaterial) ||
    normalizedMaterial.includes(normalizeIngredientName(ingredient.canonicalName))
  );
}

function isCommonPantryMaterial(material: string): boolean {
  const normalizedMaterial = normalizeIngredientName(material);
  return commonPantryKeywords.some((keyword) =>
    normalizedMaterial.includes(normalizeIngredientName(keyword)),
  );
}

function parseRecipeMinutes(value?: string): number {
  if (!value || value === "指定なし") {
    return 30;
  }
  if (value.includes("5分以内")) {
    return 5;
  }
  if (value.includes("1時間以上")) {
    return 75;
  }
  if (value.includes("約1時間")) {
    return 60;
  }

  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 30;
}

function parseRecipeCost(value?: string): number {
  if (!value || value === "指定なし") {
    return 800;
  }
  if (value.includes("100円以下")) {
    return 100;
  }

  const match = value.replace(/,/g, "").match(/(\d+)/);
  return match ? Number(match[1]) : 800;
}

function normalizeRank(value?: number | string): number | null {
  const rank = Number(value);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function buildExternalRecipeReason({
  usedCount,
  missingCount,
  usesExpiringIngredient,
  minutes,
  cost,
}: {
  usedCount: number;
  missingCount: number;
  usesExpiringIngredient: boolean;
  minutes: number;
  cost: number;
}): string {
  const reasons: string[] = [];

  if (usedCount > 0) {
    reasons.push(`手持ち食材が${usedCount}件合いそう`);
  }
  if (usesExpiringIngredient) {
    reasons.push("期限が近い食材を使える");
  }
  if (minutes <= 15) {
    reasons.push("短時間で作りやすい");
  }
  if (cost <= 500) {
    reasons.push("費用目安が安め");
  }
  if (missingCount <= 2) {
    reasons.push("足りない可能性がある食材が少ない");
  }

  return reasons.length > 0 ? reasons.join(" / ") : "食材カテゴリが近い楽天レシピです";
}
