import type { HouseholdData } from "@/types/domain";

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
      return {
        schemaVersion: 1,
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
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

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
