import { daysUntil, isSameMonth } from "@/lib/date";
import type {
  CookedDish,
  ExpiryType,
  HouseholdData,
  Ingredient,
  RecurringExpense,
  Transaction,
} from "@/types/domain";

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

export type RecurringExpenseOccurrence = {
  expense: RecurringExpense;
  dueDate: string;
  daysUntilDue: number;
};

export type RecurringMonthlySummary = {
  total: number;
  activeCount: number;
  occurrenceCount: number;
  categoryTotals: Record<string, number>;
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

export function getNextRecurringPaymentDate(
  expense: RecurringExpense,
  fromDate = new Date(),
): string {
  const start = startOfDay(fromDate);

  if (expense.frequency === "weekly") {
    const diff = (expense.paymentDay - start.getDay() + 7) % 7;
    return toIsoDate(addDays(start, diff));
  }

  if (expense.frequency === "yearly") {
    const currentYear = start.getFullYear();
    const thisYear = makeDate(currentYear, expense.paymentMonth, expense.paymentDay);
    if (thisYear.getTime() >= start.getTime()) {
      return toIsoDate(thisYear);
    }

    return toIsoDate(makeDate(currentYear + 1, expense.paymentMonth, expense.paymentDay));
  }

  const currentYear = start.getFullYear();
  const currentMonth = start.getMonth() + 1;
  const thisMonth = makeDate(currentYear, currentMonth, expense.paymentDay);
  if (thisMonth.getTime() >= start.getTime()) {
    return toIsoDate(thisMonth);
  }

  const nextMonthDate = new Date(currentYear, currentMonth, 1);
  return toIsoDate(
    makeDate(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, expense.paymentDay),
  );
}

export function getRecurringOccurrencesForMonth(
  expense: RecurringExpense,
  monthKey: string,
): string[] {
  if (expense.status !== "active") {
    return [];
  }

  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) {
    return [];
  }

  if (expense.frequency === "yearly") {
    return expense.paymentMonth === month
      ? [toIsoDate(makeDate(year, month, expense.paymentDay))]
      : [];
  }

  if (expense.frequency === "monthly") {
    return [toIsoDate(makeDate(year, month, expense.paymentDay))];
  }

  const dates: string[] = [];
  const lastDay = getDaysInMonth(year, month);
  for (let day = 1; day <= lastDay; day += 1) {
    const date = makeDate(year, month, day);
    if (date.getDay() === expense.paymentDay) {
      dates.push(toIsoDate(date));
    }
  }

  return dates;
}

export function getRecurringMonthlySummary(
  expenses: RecurringExpense[],
  monthKey: string,
): RecurringMonthlySummary {
  const activeExpenses = expenses.filter((expense) => expense.status === "active");
  const categoryTotals: Record<string, number> = {};
  let total = 0;
  let occurrenceCount = 0;

  activeExpenses.forEach((expense) => {
    const occurrences = getRecurringOccurrencesForMonth(expense, monthKey);
    const amount = expense.amount * occurrences.length;
    total += amount;
    occurrenceCount += occurrences.length;
    categoryTotals[expense.category] = (categoryTotals[expense.category] ?? 0) + amount;
  });

  return {
    total,
    activeCount: activeExpenses.length,
    occurrenceCount,
    categoryTotals,
  };
}

export function getUpcomingRecurringExpenses(
  expenses: RecurringExpense[],
  limit = 6,
): RecurringExpenseOccurrence[] {
  return expenses
    .filter((expense) => expense.status === "active")
    .map((expense) => {
      const dueDate = getNextRecurringPaymentDate(expense);
      return {
        expense,
        dueDate,
        daysUntilDue: daysUntil(dueDate),
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue || a.expense.name.localeCompare(b.expense.name, "ja"))
    .slice(0, limit);
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

function makeDate(year: number, month: number, day: number): Date {
  const clampedDay = Math.min(day, getDaysInMonth(year, month));
  return new Date(year, month - 1, clampedDay);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
