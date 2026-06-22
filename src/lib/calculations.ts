import { daysUntil, isSameMonth } from "@/lib/date";
import type { HouseholdData, Ingredient, Transaction } from "@/types/domain";

export type MonthlySummary = {
  income: number;
  expense: number;
  balance: number;
  transactionCount: number;
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

export function getActiveIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients
    .filter((ingredient) => ingredient.status === "active")
    .sort((a, b) => {
      const diff = daysUntil(a.expiryDate) - daysUntil(b.expiryDate);
      return diff === 0 ? a.name.localeCompare(b.name, "ja") : diff;
    });
}

export function getExpiringIngredients(
  ingredients: Ingredient[],
  withinDays = 5,
): Ingredient[] {
  return getActiveIngredients(ingredients).filter(
    (ingredient) => daysUntil(ingredient.expiryDate) <= withinDays,
  );
}

export function getExpiryTone(expiryDate: string): {
  label: string;
  className: string;
} {
  const days = daysUntil(expiryDate);

  if (days < 0) {
    return {
      label: `${Math.abs(days)}日超過`,
      className: "border-tomato/30 bg-tomato/10 text-tomato",
    };
  }

  if (days === 0) {
    return {
      label: "今日まで",
      className: "border-tomato/30 bg-tomato/10 text-tomato",
    };
  }

  if (days <= 2) {
    return {
      label: `あと${days}日`,
      className: "border-honey/40 bg-honey/15 text-[#8a570a]",
    };
  }

  return {
    label: `あと${days}日`,
    className: "border-leaf/25 bg-leaf/10 text-leaf",
  };
}
