import type {
  ExpiryType,
  HouseholdData,
  Ingredient,
  IngredientUnit,
  OpenedStatus,
  StorageLocation,
} from "@/types/domain";
import { ingredientUnitOptions } from "@/types/domain";

const STORAGE_KEY = "manual-household-mvp:v1";

export const emptyHouseholdData: HouseholdData = {
  schemaVersion: 1,
  transactions: [],
  ingredients: [],
};

export interface HouseholdRepository {
  load(): Promise<HouseholdData>;
  save(data: HouseholdData): Promise<void>;
}

export class LocalStorageHouseholdRepository implements HouseholdRepository {
  async load(): Promise<HouseholdData> {
    if (typeof window === "undefined") {
      return emptyHouseholdData;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyHouseholdData;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<HouseholdData>;
      const ingredients = Array.isArray(parsed.ingredients)
        ? parsed.ingredients.map((ingredient) => normalizeIngredient(ingredient))
        : [];

      return {
        schemaVersion: 1,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        ingredients,
      };
    } catch {
      return emptyHouseholdData;
    }
  }

  async save(data: HouseholdData): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

function normalizeIngredient(value: unknown): Ingredient {
  const source = (value ?? {}) as Partial<Ingredient> & {
    price?: unknown;
    expiryType?: unknown;
    openedStatus?: unknown;
    storageLocation?: unknown;
    unit?: unknown;
  };
  const now = new Date().toISOString();
  const expiryDate = typeof source.expiryDate === "string" ? source.expiryDate : "";

  return {
    id: typeof source.id === "string" ? source.id : createId("food"),
    name: typeof source.name === "string" ? source.name : "",
    price: normalizePrice(source.price),
    quantity: typeof source.quantity === "string" ? source.quantity : "1",
    unit: normalizeUnit(source.unit),
    purchaseDate: typeof source.purchaseDate === "string" ? source.purchaseDate : "",
    expiryDate,
    expiryType: normalizeExpiryType(source.expiryType, expiryDate),
    storageLocation: normalizeStorageLocation(source.storageLocation),
    openedStatus: normalizeOpenedStatus(source.openedStatus),
    status: source.status === "used" || source.status === "discarded" ? source.status : "active",
    memo: typeof source.memo === "string" ? source.memo : "",
    createdAt: typeof source.createdAt === "string" ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
  };
}

function normalizePrice(value: unknown): number {
  const price = typeof value === "number" ? value : Number(value);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function normalizeUnit(value: unknown): IngredientUnit {
  return typeof value === "string" && ingredientUnitOptions.includes(value as IngredientUnit)
    ? (value as IngredientUnit)
    : "その他";
}

function normalizeExpiryType(value: unknown, expiryDate: string): ExpiryType {
  if (value === "best_before" || value === "use_by" || value === "none") {
    return value;
  }

  return expiryDate ? "best_before" : "none";
}

function normalizeStorageLocation(value: unknown): StorageLocation {
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

  if (value === "pantry") {
    return "room";
  }

  return "fridge";
}

function normalizeOpenedStatus(value: unknown): OpenedStatus {
  return value === "opened" ? "opened" : "unopened";
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
