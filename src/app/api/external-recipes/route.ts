import { NextResponse } from "next/server";

import {
  pickRakutenRecipeCategories,
  scoreExternalRecipes,
} from "@/lib/externalRecipes";
import type {
  ExternalRecipeSearchIngredient,
  RakutenRecipeCategory,
  RakutenRecipeRankingItem,
} from "@/lib/externalRecipes";
import type { IngredientDictionaryItem, StorageLocation } from "@/types/domain";

const CATEGORY_LIST_URL =
  "https://openapi.rakuten.co.jp/recipems/api/Recipe/CategoryList/20170426";
const CATEGORY_RANKING_URL =
  "https://openapi.rakuten.co.jp/recipems/api/Recipe/CategoryRanking/20170426";
const FALLBACK_MESSAGE = "外部レシピを取得できませんでした。手持ちレシピから提案します。";
const RAKUTEN_ENV_NAMES = {
  applicationId: "RAKUTEN_APPLICATION_ID",
  accessKey: "RAKUTEN_ACCESS_KEY",
} as const;
const RAKUTEN_RANKING_CATEGORIES: Array<
  RakutenRecipeCategory & { ingredientCategories: ExternalRecipeSearchIngredient["category"][] }
> = [
  { categoryId: "30", categoryName: "人気メニュー", ingredientCategories: ["other"] },
  { categoryId: "33", categoryName: "卵料理", ingredientCategories: ["egg"] },
  { categoryId: "12", categoryName: "野菜", ingredientCategories: ["vegetable"] },
  { categoryId: "10", categoryName: "肉", ingredientCategories: ["meat"] },
  { categoryId: "14", categoryName: "ご飯もの", ingredientCategories: ["staple"] },
  { categoryId: "15", categoryName: "パスタ", ingredientCategories: ["staple"] },
  { categoryId: "35", categoryName: "大豆・豆腐", ingredientCategories: ["soy"] },
  { categoryId: "13-482", categoryName: "チーズ", ingredientCategories: ["dairy"] },
  { categoryId: "17", categoryName: "汁物・スープ", ingredientCategories: ["seasoning"] },
];
const GENERAL_RANKING_CATEGORY: RakutenRecipeCategory = {
  categoryId: "",
  categoryName: "総合ランキング",
};

export const dynamic = "force-dynamic";

type RakutenEnvironment = {
  applicationId: string;
  accessKey: string;
  missingNames: string[];
};

type RakutenApiContext = "category-list" | "category-ranking";

class RakutenApiError extends Error {
  context: RakutenApiContext;
  details?: Record<string, unknown>;
  status?: number;

  constructor(
    context: RakutenApiContext,
    message: string,
    status?: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RakutenApiError";
    this.context = context;
    this.status = status;
    this.details = details;
  }
}

export async function GET() {
  const environment = readRakutenEnvironment();

  return NextResponse.json({
    configured: environment.missingNames.length === 0,
    missingEnvNames: environment.missingNames,
    hasApplicationId: Boolean(environment.applicationId),
    hasAccessKey: Boolean(environment.accessKey),
  });
}

export async function POST(request: Request) {
  const environment = readRakutenEnvironment();

  logExternalRecipeInfo("request-received", {
    configured: environment.missingNames.length === 0,
    missingEnvNames: environment.missingNames,
    hasApplicationId: Boolean(environment.applicationId),
    hasAccessKey: Boolean(environment.accessKey),
  });

  if (environment.missingNames.length > 0) {
    return NextResponse.json({
      recipes: [],
      message: buildMissingEnvironmentMessage(environment.missingNames),
      envStatus: {
        configured: false,
        missingEnvNames: environment.missingNames,
      },
    });
  }

  try {
    const body = (await request.json()) as {
      ingredients?: unknown;
      userIngredientDictionary?: unknown;
    };
    const ingredients = normalizeSearchIngredients(body.ingredients);
    const userIngredientDictionary = normalizeUserIngredientDictionary(body.userIngredientDictionary);

    logExternalRecipeInfo("request", {
      hasApplicationId: Boolean(environment.applicationId),
      hasAccessKey: Boolean(environment.accessKey),
      ingredientCount: ingredients.length,
      userDictionaryCount: userIngredientDictionary.length,
    });

    if (ingredients.length === 0) {
      return NextResponse.json({ recipes: [], message: "" });
    }

    const categories = await fetchRakutenCategories(
      environment.applicationId,
      environment.accessKey,
    ).catch((error) => {
      logExternalRecipeError(error);
      return [];
    });
    const targetCategories = pickRankingCategories(categories, ingredients, 4);
    logExternalRecipeInfo("category-selection", {
      sourceCategoryCount: categories.length,
      selectedCategoryIds: targetCategories.map((category) => category.categoryId),
      selectedCategoryNames: targetCategories.map((category) => category.categoryName),
    });

    const rankingResults = await Promise.allSettled(
      targetCategories.map((category) =>
        fetchRakutenRecipeRanking(environment.applicationId, environment.accessKey, category),
      ),
    );
    const rankingRecipes = rankingResults.flatMap((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      logExternalRecipeError(result.reason);
      return [];
    });
    logExternalRecipeInfo("ranking-result", {
      requestedCategoryCount: targetCategories.length,
      failedCategoryCount: rankingResults.filter((result) => result.status === "rejected").length,
      rawRecipeCount: rankingRecipes.length,
    });

    const recipes = scoreExternalRecipes(
      dedupeRecipes(rankingRecipes),
      ingredients,
      userIngredientDictionary,
    ).slice(0, 8);
    logExternalRecipeInfo("scored-result", {
      recipeCount: recipes.length,
    });

    return NextResponse.json({
      recipes,
      message: recipes.length === 0 ? FALLBACK_MESSAGE : "",
    });
  } catch (error) {
    logExternalRecipeError(error);
    return NextResponse.json({ recipes: [], message: FALLBACK_MESSAGE });
  }
}

function readRakutenEnvironment(): RakutenEnvironment {
  const applicationId = (process.env[RAKUTEN_ENV_NAMES.applicationId] ?? "").trim();
  const accessKey = (process.env[RAKUTEN_ENV_NAMES.accessKey] ?? "").trim();
  const missingNames: string[] = [];

  if (!applicationId) {
    missingNames.push(RAKUTEN_ENV_NAMES.applicationId);
  }
  if (!accessKey) {
    missingNames.push(RAKUTEN_ENV_NAMES.accessKey);
  }

  return {
    applicationId,
    accessKey,
    missingNames,
  };
}

function buildMissingEnvironmentMessage(missingNames: string[]): string {
  return [
    "楽天レシピAPIの環境変数が未設定です。手持ちレシピから提案します。",
    `不足: ${missingNames.join(", ")}`,
    "Vercelで設定後、Production/Previewの対象環境を確認して再デプロイしてください。",
  ].join(" ");
}

async function fetchRakutenCategories(
  applicationId: string,
  accessKey: string,
): Promise<RakutenRecipeCategory[]> {
  const url = new URL(CATEGORY_LIST_URL);
  appendRakutenAuthParams(url, applicationId, accessKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");

  logExternalRecipeInfo("rakuten-request", {
    context: "category-list",
    authPlacement: "query",
  });

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: buildRakutenHeaders(),
    });
  } catch (error) {
    throw new RakutenApiError(
      "category-list",
      "Rakuten recipe category list network request failed",
      undefined,
      readNetworkErrorDetails(error),
    );
  }

  logExternalRecipeInfo("rakuten-response", {
    context: "category-list",
    status: response.status,
  });

  if (!response.ok) {
    throw new RakutenApiError(
      "category-list",
      "Rakuten recipe category list request failed",
      response.status,
      await readRakutenErrorSummary(response),
    );
  }

  const data = (await response.json()) as {
    result?: unknown;
  };
  const categories = normalizeRakutenCategories(data.result);
  logExternalRecipeInfo("category-list-result", {
    categoryCount: categories.length,
    resultShape: describeResponseShape(data.result),
  });

  return categories;
}

async function fetchRakutenRecipeRanking(
  applicationId: string,
  accessKey: string,
  category: RakutenRecipeCategory,
): Promise<RakutenRecipeRankingItem[]> {
  const categoryLabel = category.categoryId || "overall";
  const url = new URL(CATEGORY_RANKING_URL);
  appendRakutenAuthParams(url, applicationId, accessKey);
  if (category.categoryId) {
    url.searchParams.set("categoryId", category.categoryId);
  }
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");
  url.searchParams.set(
    "elements",
    [
      "recipeId",
      "recipeTitle",
      "recipeUrl",
      "foodImageUrl",
      "mediumImageUrl",
      "smallImageUrl",
      "recipeDescription",
      "recipeMaterial",
      "recipeIndication",
      "recipeCost",
      "rank",
    ].join(","),
  );

  logExternalRecipeInfo("rakuten-request", {
    context: "category-ranking",
    categoryId: categoryLabel,
    categoryName: category.categoryName,
    authPlacement: "query",
  });

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: buildRakutenHeaders(),
    });
  } catch (error) {
    throw new RakutenApiError(
      "category-ranking",
      `Rakuten recipe ranking network request failed for category ${categoryLabel}`,
      undefined,
      {
        categoryId: categoryLabel,
        categoryName: category.categoryName,
        ...readNetworkErrorDetails(error),
      },
    );
  }
  logExternalRecipeInfo("rakuten-response", {
    context: "category-ranking",
    categoryId: categoryLabel,
    categoryName: category.categoryName,
    status: response.status,
  });

  if (!response.ok) {
    throw new RakutenApiError(
      "category-ranking",
      `Rakuten recipe ranking request failed for category ${categoryLabel}`,
      response.status,
      await readRakutenErrorSummary(response),
    );
  }

  const data = (await response.json()) as {
    result?: unknown;
  };
  const recipes = normalizeRakutenRankingItems(data.result);
  logExternalRecipeInfo("ranking-result-shape", {
    categoryId: categoryLabel,
    categoryName: category.categoryName,
    rawRecipeCount: recipes.length,
    resultShape: describeResponseShape(data.result),
  });
  if (recipes.length === 0) {
    logExternalRecipeInfo("ranking-empty", {
      categoryId: categoryLabel,
      categoryName: category.categoryName,
      resultShape: describeResponseShape(data.result),
    });
  }

  return recipes.map((recipe) => ({
    ...recipe,
    categoryName: category.categoryName,
  }));
}

function normalizeRakutenCategories(value: unknown): RakutenRecipeCategory[] {
  const categoryGroups = isObject(value)
    ? [value.large, value.medium, value.small]
    : [value];
  const candidates = categoryGroups.flatMap((group) => (Array.isArray(group) ? group : []));

  return candidates
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => ({
      categoryId: String(item.categoryId ?? "").trim(),
      categoryName: String(item.categoryName ?? "").trim(),
      categoryUrl: typeof item.categoryUrl === "string" ? item.categoryUrl : undefined,
    }))
    .filter((category) => category.categoryId && category.categoryName);
}

function normalizeRakutenRankingItems(value: unknown): RakutenRecipeRankingItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => isObject(item))
    .map((item) => ({
      recipeId: String(item.recipeId ?? "").trim(),
      recipeTitle: String(item.recipeTitle ?? "").trim(),
      recipeUrl: String(item.recipeUrl ?? "").trim(),
      foodImageUrl: typeof item.foodImageUrl === "string" ? item.foodImageUrl : undefined,
      mediumImageUrl: typeof item.mediumImageUrl === "string" ? item.mediumImageUrl : undefined,
      smallImageUrl: typeof item.smallImageUrl === "string" ? item.smallImageUrl : undefined,
      recipeDescription:
        typeof item.recipeDescription === "string" ? item.recipeDescription : undefined,
      recipeMaterial: normalizeStringArray(item.recipeMaterial),
      recipeIndication: typeof item.recipeIndication === "string" ? item.recipeIndication : undefined,
      recipeCost: typeof item.recipeCost === "string" ? item.recipeCost : undefined,
      rank: typeof item.rank === "number" || typeof item.rank === "string" ? item.rank : undefined,
    }))
    .filter((recipe) => recipe.recipeId && recipe.recipeTitle && recipe.recipeUrl);
}

function pickRankingCategories(
  categories: RakutenRecipeCategory[],
  ingredients: ExternalRecipeSearchIngredient[],
  limit: number,
): RakutenRecipeCategory[] {
  const apiCategories = pickRakutenRecipeCategories(categories, ingredients, limit);
  const ingredientCategories = new Set(ingredients.map((ingredient) => ingredient.category));
  const fallbackCategories = RAKUTEN_RANKING_CATEGORIES.filter((category) =>
    category.ingredientCategories.some((ingredientCategory) =>
      ingredientCategories.has(ingredientCategory),
    ),
  );

  return dedupeCategories([
    ...apiCategories,
    ...fallbackCategories,
    GENERAL_RANKING_CATEGORY,
  ]).slice(0, limit);
}

function dedupeCategories(categories: RakutenRecipeCategory[]): RakutenRecipeCategory[] {
  const seen = new Set<string>();
  return categories.filter((category) => {
    const key = category.categoryId || category.categoryName;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeSearchIngredients(value: unknown): ExternalRecipeSearchIngredient[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ExternalRecipeSearchIngredient => {
      const candidate = item as Partial<ExternalRecipeSearchIngredient>;
      return (
        typeof candidate.name === "string" &&
        typeof candidate.canonicalName === "string" &&
        typeof candidate.normalizedName === "string" &&
        typeof candidate.category === "string"
      );
    })
    .map((ingredient) => ({
      name: ingredient.name,
      canonicalName: ingredient.canonicalName,
      normalizedName: ingredient.normalizedName,
      category: ingredient.category,
      expiryDays: typeof ingredient.expiryDays === "number" ? ingredient.expiryDays : null,
    }));
}

function dedupeRecipes(recipes: RakutenRecipeRankingItem[]): RakutenRecipeRankingItem[] {
  const seen = new Set<string>();
  return recipes.filter((recipe) => {
    const recipeId = String(recipe.recipeId);
    if (seen.has(recipeId)) {
      return false;
    }

    seen.add(recipeId);
    return true;
  });
}

function normalizeUserIngredientDictionary(value: unknown): IngredientDictionaryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Partial<IngredientDictionaryItem> => {
      const candidate = item as Partial<IngredientDictionaryItem>;
      return typeof candidate.displayName === "string" && candidate.displayName.trim().length > 0;
    })
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : `user-${item.displayName}`,
      displayName: item.displayName ?? "",
      aliases: normalizeStringArray(item.aliases),
      category: typeof item.category === "string" && item.category ? item.category : "未分類",
      storageType: normalizeStorageType(item.storageType),
      defaultExpiryDays:
        typeof item.defaultExpiryDays === "number" && item.defaultExpiryDays >= 0
          ? item.defaultExpiryDays
          : 7,
      recipeCategories: normalizeStringArray(item.recipeCategories),
      tags: normalizeStringArray(item.tags),
      compatibleIngredients: normalizeStringArray(item.compatibleIngredients),
      groupId: typeof item.groupId === "string" ? item.groupId : item.id,
      isUserDefined: true,
    }));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function appendRakutenAuthParams(url: URL, applicationId: string, accessKey: string) {
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("accessKey", accessKey);
}

function buildRakutenHeaders(): HeadersInit {
  return {
    Accept: "application/json",
  };
}

async function readRakutenErrorSummary(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    const text = await response.text();
    const responsePreview = text.slice(0, 500);

    if (contentType.includes("application/json")) {
      let data: unknown;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        return { responsePreview };
      }

      if (isObject(data)) {
        const nestedErrors = isObject(data.errors) ? data.errors : null;
        return {
          responsePreview,
          error: typeof data.error === "string" ? data.error : undefined,
          errorDescription:
            typeof data.error_description === "string" ? data.error_description : undefined,
          errorCode:
            nestedErrors &&
            (typeof nestedErrors.errorCode === "number" || typeof nestedErrors.errorCode === "string")
              ? nestedErrors.errorCode
              : undefined,
          errorMessage:
            nestedErrors && typeof nestedErrors.errorMessage === "string"
              ? nestedErrors.errorMessage
              : undefined,
        };
      }
    }

    return {
      responsePreview,
    };
  } catch {
    return {
      responsePreview: "Unable to read response body",
    };
  }
}

function readNetworkErrorDetails(error: unknown): Record<string, unknown> {
  return {
    networkError: true,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : "Unknown network error",
  };
}

function describeResponseShape(value: unknown): string {
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }
  if (isObject(value)) {
    return `object(${Object.keys(value).join(",")})`;
  }
  return typeof value;
}

function logExternalRecipeInfo(event: string, details: Record<string, unknown>) {
  console.info("[ExternalRecipe API]", {
    event,
    ...details,
  });
}

function logExternalRecipeError(error: unknown) {
  if (error instanceof RakutenApiError) {
    console.error("Failed to fetch external recipes", {
      context: error.context,
      status: error.status ?? null,
      message: error.message,
      details: error.details ?? null,
    });
    return;
  }

  console.error("Failed to fetch external recipes", {
    message: error instanceof Error ? error.message : "Unknown error",
  });
}

function normalizeStorageType(value: unknown): StorageLocation {
  if (
    value === "room" ||
    value === "fridge" ||
    value === "freezer" ||
    value === "vegetable_room" ||
    value === "opened_fridge" ||
    value === "other"
  ) {
    return value;
  }

  return "fridge";
}
