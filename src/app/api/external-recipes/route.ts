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

export const dynamic = "force-dynamic";

type RakutenEnvironment = {
  applicationId: string;
  accessKey: string;
  missingNames: string[];
};

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

    if (ingredients.length === 0) {
      return NextResponse.json({ recipes: [], message: "" });
    }

    const categories = await fetchRakutenCategories(environment.applicationId, environment.accessKey);
    const selectedCategories = pickRakutenRecipeCategories(categories, ingredients, 4);
    const targetCategories =
      selectedCategories.length > 0 ? selectedCategories : categories.slice(0, 1);
    const rankingRecipes = (
      await Promise.all(
        targetCategories.map((category) =>
          fetchRakutenRecipeRanking(environment.applicationId, environment.accessKey, category),
        ),
      )
    ).flat();
    const recipes = scoreExternalRecipes(
      dedupeRecipes(rankingRecipes),
      ingredients,
      userIngredientDictionary,
    ).slice(0, 8);

    return NextResponse.json({
      recipes,
      message: recipes.length === 0 ? FALLBACK_MESSAGE : "",
    });
  } catch (error) {
    console.error("Failed to fetch external recipes", error);
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
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("categoryType", "large");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accessKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Rakuten category list failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: {
      large?: RakutenRecipeCategory[];
    };
  };

  return Array.isArray(data.result?.large) ? data.result.large : [];
}

async function fetchRakutenRecipeRanking(
  applicationId: string,
  accessKey: string,
  category: RakutenRecipeCategory,
): Promise<RakutenRecipeRankingItem[]> {
  const url = new URL(CATEGORY_RANKING_URL);
  url.searchParams.set("applicationId", applicationId);
  url.searchParams.set("categoryId", category.categoryId);
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

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accessKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Rakuten recipe ranking failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    result?: RakutenRecipeRankingItem[];
  };
  const recipes = Array.isArray(data.result) ? data.result : [];

  return recipes.map((recipe) => ({
    ...recipe,
    categoryName: category.categoryName,
  }));
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
