import { getCanonicalIngredient, matchIngredients, mergeIngredientDictionaries } from "@/lib/ingredients";
import type {
  CookedDishIngredient,
  CookingCostStatus,
  Ingredient,
  IngredientDictionaryItem,
  IngredientUnit,
} from "@/types/domain";

export type CookingIngredientInput = {
  id: string;
  ingredientName: string;
  ingredientId: string;
  usedQuantity: number;
  unit: IngredientUnit;
  note: string;
};

export type CookingIngredientDraft = CookedDishIngredient & {
  exceedsStock: boolean;
  canDecrementStock: boolean;
};

export type CookingCalculationResult = {
  ingredients: CookingIngredientDraft[];
  totalCost: number | null;
  warnings: string[];
};

const convertibleUnits: Record<string, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  L: 1000,
};

export function calculateCookedDishIngredients({
  inputs,
  stockIngredients,
  userIngredientDictionary,
}: {
  inputs: CookingIngredientInput[];
  stockIngredients: Ingredient[];
  userIngredientDictionary: IngredientDictionaryItem[];
}): CookingCalculationResult {
  const dictionary = mergeIngredientDictionaries(userIngredientDictionary);
  const usedStockIds = new Set<string>();
  const warnings: string[] = [];
  const ingredients = inputs
    .filter((input) => input.ingredientName.trim() || input.ingredientId)
    .map((input) => {
      const stock = findStockIngredient(input, stockIngredients, dictionary, usedStockIds);
      if (stock) {
        usedStockIds.add(stock.id);
      }

      const canonical = getCanonicalIngredient(input.ingredientName || stock?.name || "", dictionary);
      const draft = calculateIngredientUsage(input, stock, canonical.canonicalName);

      if (draft.exceedsStock) {
        warnings.push(`${draft.ingredientName} はストック量を超えています。`);
      }
      if (draft.costStatus === "unit_mismatch") {
        warnings.push(`${draft.ingredientName} は単位を確認してください。`);
      }

      return draft;
    });
  const calculatedCosts = ingredients
    .map((ingredient) => ingredient.costAmount)
    .filter((cost): cost is number => cost !== null);

  return {
    ingredients,
    totalCost: calculatedCosts.length > 0 ? calculatedCosts.reduce((sum, cost) => sum + cost, 0) : null,
    warnings,
  };
}

export function applyCookedDishToStock(
  stockIngredients: Ingredient[],
  cookedIngredients: CookedDishIngredient[],
): Ingredient[] {
  const usageByIngredientId = new Map(
    cookedIngredients
      .filter(
        (
          ingredient,
        ): ingredient is CookedDishIngredient & {
          ingredientId: string;
          stockQuantityAfter: number;
        } => Boolean(ingredient.ingredientId) && ingredient.stockQuantityAfter !== null,
      )
      .map((ingredient) => [ingredient.ingredientId, ingredient.stockQuantityAfter] as const),
  );

  return stockIngredients.map((ingredient) => {
    if (!usageByIngredientId.has(ingredient.id)) {
      return ingredient;
    }

    const nextQuantity = usageByIngredientId.get(ingredient.id);
    if (nextQuantity === undefined) {
      return ingredient;
    }

    return {
      ...ingredient,
      quantity: formatQuantity(nextQuantity),
      status: nextQuantity <= 0 ? "used" : ingredient.status,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function costStatusLabel(status: CookingCostStatus): string {
  const labels: Record<CookingCostStatus, string> = {
    calculated: "計算済み",
    missing_price: "金額未登録",
    missing_quantity: "数量未登録",
    unit_mismatch: "単位が一致しません",
    not_in_stock: "ストック未登録",
    invalid_usage: "使用量未入力",
    excluded: "原価計算対象外",
  };

  return labels[status];
}

function findStockIngredient(
  input: CookingIngredientInput,
  stockIngredients: Ingredient[],
  dictionary: IngredientDictionaryItem[],
  usedStockIds: Set<string>,
): Ingredient | null {
  if (input.ingredientId) {
    return stockIngredients.find((ingredient) => ingredient.id === input.ingredientId) ?? null;
  }

  return (
    stockIngredients.find(
      (ingredient) =>
        !usedStockIds.has(ingredient.id) &&
        matchIngredients(input.ingredientName, ingredient.name, dictionary),
    ) ?? null
  );
}

function calculateIngredientUsage(
  input: CookingIngredientInput,
  stock: Ingredient | null,
  canonicalName: string,
): CookingIngredientDraft {
  const ingredientName = input.ingredientName.trim() || stock?.name || "";
  const usedQuantity = Number(input.usedQuantity);

  if (!Number.isFinite(usedQuantity) || usedQuantity <= 0) {
    return createDraft(input, stock, ingredientName, canonicalName, null, null, "invalid_usage", true);
  }

  if (!stock) {
    return createDraft(input, stock, ingredientName, canonicalName, null, null, "not_in_stock", true);
  }

  const stockQuantity = Number(stock.quantity);
  if (!Number.isFinite(stockQuantity) || stockQuantity <= 0) {
    return createDraft(input, stock, ingredientName, canonicalName, null, null, "missing_quantity", true);
  }

  const conversion = getUnitConversion(input.unit, stock.unit);
  if (!conversion) {
    return createDraft(input, stock, ingredientName, canonicalName, stockQuantity, null, "unit_mismatch", false);
  }

  const usedInStockUnit = usedQuantity * conversion.toStockUnit;
  const stockQuantityAfter = Math.max(0, stockQuantity - usedInStockUnit);
  const exceedsStock = usedInStockUnit > stockQuantity;

  if (stock.price <= 0) {
    return createDraft(input, stock, ingredientName, canonicalName, stockQuantity, stockQuantityAfter, "missing_price", true, exceedsStock);
  }

  const costAmount = (stock.price / stockQuantity) * usedInStockUnit;
  return {
    ...createDraft(input, stock, ingredientName, canonicalName, stockQuantity, stockQuantityAfter, "calculated", true, exceedsStock),
    costAmount,
  };
}

function createDraft(
  input: CookingIngredientInput,
  stock: Ingredient | null,
  ingredientName: string,
  canonicalName: string,
  stockQuantityBefore: number | null,
  stockQuantityAfter: number | null,
  costStatus: CookingCostStatus,
  canDecrementStock: boolean,
  exceedsStock = false,
): CookingIngredientDraft {
  return {
    id: input.id,
    ingredientId: stock?.id ?? null,
    ingredientName,
    canonicalName,
    usedQuantity: input.usedQuantity,
    unit: input.unit,
    stockQuantityBefore,
    stockQuantityAfter,
    stockUnit: stock?.unit ?? null,
    costAmount: null,
    costStatus,
    note: input.note,
    exceedsStock,
    canDecrementStock,
  };
}

function getUnitConversion(
  usageUnit: IngredientUnit,
  stockUnit: IngredientUnit,
): { toStockUnit: number } | null {
  if (usageUnit === stockUnit) {
    return { toStockUnit: 1 };
  }

  const usageBase = convertibleUnits[usageUnit];
  const stockBase = convertibleUnits[stockUnit];
  if (!usageBase || !stockBase) {
    return null;
  }

  const sameMass = (usageUnit === "g" || usageUnit === "kg") && (stockUnit === "g" || stockUnit === "kg");
  const sameVolume = (usageUnit === "ml" || usageUnit === "L") && (stockUnit === "ml" || stockUnit === "L");
  if (!sameMass && !sameVolume) {
    return null;
  }

  return {
    toStockUnit: usageBase / stockBase,
  };
}

function formatQuantity(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}
