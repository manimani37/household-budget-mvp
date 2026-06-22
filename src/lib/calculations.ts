import { daysUntil, isSameMonth } from "@/lib/date";
import type { CookedDish, ExpiryType, HouseholdData, Ingredient, Transaction } from "@/types/domain";

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
};

export type CookingMonthlySummary = {
  dishCount: number;
  totalCost: number;
  averageCostPerDish: number;
};

export function getMonthlyTransactions(
  transactions: Transaction[],
  monthKey: string,
): Transaction[] {
  return transactions
    .filter((transaction) => isSameMonth(transaction.date, monthKey))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getMonthlySummary(
  data: HouseholdData,
  monthKey: string,
): MonthlySummary {
  const monthly = getMonthlyTransactions(data.transactions, monthKey);
  const income = monthly
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const expense = monthly
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    income,
    expense,
    balance: income - expense,
    transactionCount: monthly.length,
  };
}

export function getMonthlyCookedDishes(
  cookedDishes: CookedDish[],
  monthKey: string,
): CookedDish[] {
  return cookedDishes
    .filter((dish) => isSameMonth(dish.cookedDate, monthKey))
    .sort((a, b) => b.cookedDate.localeCompare(a.cookedDate));
}

export function getCookingMonthlySummary(
  cookedDishes: CookedDish[],
  monthKey: string,
): CookingMonthlySummary {
  const monthly = getMonthlyCookedDishes(cookedDishes, monthKey);
  const costs = monthly
    .map((dish) => dish.totalCost)
    .filter((cost): cost is number => cost !== null);
  const totalCost = costs.reduce((sum, cost) => sum + cost, 0);

  return {
    dishCount: monthly.length,
    totalCost,
    averageCostPerDish: costs.length > 0 ? totalCost / costs.length : 0,
  };
}

export function getActiveIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients
    .filter((ingredient) => ingredient.status === "active")
    .sort((a, b) => {
      const aDays = getIngredientExpiryDays(a);
      const bDays = getIngredientExpiryDays(b);
      if (aDays === null && bDays === null) {
        return a.name.localeCompare(b.name, "ja");
      }
      if (aDays === null) {
        return 1;
      }
      if (bDays === null) {
        return -1;
      }
      const diff = aDays - bDays;
      return diff === 0 ? a.name.localeCompare(b.name, "ja") : diff;
    });
}

export function getExpiringIngredients(
  ingredients: Ingredient[],
  withinDays = 5,
): Ingredient[] {
  return getActiveIngredients(ingredients).filter(
    (ingredient) => {
      const days = getIngredientExpiryDays(ingredient);
      return days !== null && days <= withinDays;
    },
  );
}

export function getIngredientExpiryDays(ingredient: Ingredient): number | null {
  if (ingredient.expiryType === "none" || !ingredient.expiryDate) {
    return null;
  }

  return daysUntil(ingredient.expiryDate);
}

export function getIngredientExpiryInfo(ingredient: Ingredient): {
  label: string;
  detail: string;
  className: string;
  days: number | null;
} {
  const days = getIngredientExpiryDays(ingredient);

  if (days === null) {
    return {
      label: "期限なし",
      detail: "期限なし",
      className: "border-ink/15 bg-white text-ink/60",
      days,
    };
  }

  if (days < 0) {
    return {
      label: "期限切れ",
      detail: `${Math.abs(days)}日超過`,
      className: "border-tomato/30 bg-tomato/10 text-tomato",
      days,
    };
  }

  if (days === 0) {
    return {
      label: "今日まで",
      detail: "あと0日",
      className: "border-tomato/30 bg-tomato/10 text-tomato",
      days,
    };
  }

  if (days <= 3) {
    return {
      label: "期限間近",
      detail: `あと${days}日`,
      className: "border-honey/40 bg-honey/15 text-[#8a570a]",
      days,
    };
  }

  return {
    label: `あと${days}日`,
    detail: `あと${days}日`,
    className: "border-leaf/25 bg-leaf/10 text-leaf",
    days,
  };
}

export function getExpiryTone(expiryDate: string, expiryType: ExpiryType = "best_before"): {
  label: string;
  className: string;
} {
  if (expiryType === "none" || !expiryDate) {
    return {
      label: "期限なし",
      className: "border-ink/15 bg-white text-ink/60",
    };
  }

  const days = daysUntil(expiryDate);

  if (days < 0) {
    return {
      label: "期限切れ",
      className: "border-tomato/30 bg-tomato/10 text-tomato",
    };
  }

  if (days === 0) {
    return {
      label: "今日まで",
      className: "border-tomato/30 bg-tomato/10 text-tomato",
    };
  }

  if (days <= 3) {
    return {
      label: "期限間近",
      className: "border-honey/40 bg-honey/15 text-[#8a570a]",
    };
  }

  return {
    label: `あと${days}日`,
    className: "border-leaf/25 bg-leaf/10 text-leaf",
  };
}
