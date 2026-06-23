export type TransactionType = "expense" | "income";

export type RecurringExpenseFrequency = "monthly" | "weekly" | "yearly";

export type RecurringExpenseStatus = "active" | "paused";

export type PaymentMethod =
  | "cash"
  | "paypay"
  | "credit_card"
  | "transit_ic"
  | "bank_transfer"
  | "other";

export type IngredientStatus = "active" | "used" | "discarded";

export type IngredientUnit = "個" | "本" | "袋" | "パック" | "g" | "kg" | "ml" | "L" | "その他";

export type ExpiryType = "best_before" | "use_by" | "none";

export type StorageLocation =
  | "room"
  | "fridge"
  | "freezer"
  | "vegetable_room"
  | "opened_fridge"
  | "other";

export type OpenedStatus = "unopened" | "opened";

export type RecipeRating = 1 | 2 | 3 | 4 | 5;

export type CookingCostStatus =
  | "calculated"
  | "missing_price"
  | "missing_quantity"
  | "unit_mismatch"
  | "not_in_stock"
  | "invalid_usage"
  | "excluded";

export type IngredientDictionaryItem = {
  id: string;
  displayName: string;
  aliases: string[];
  category: string;
  storageType: StorageLocation;
  defaultExpiryDays: number;
  recipeCategories: string[];
  tags: string[];
  compatibleIngredients: string[];
  groupId?: string;
  isUserDefined?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  date: string;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type RecurringExpense = {
  id: string;
  name: string;
  amount: number;
  category: string;
  frequency: RecurringExpenseFrequency;
  paymentDay: number;
  paymentMonth: number;
  paymentMethod: PaymentMethod;
  memo: string;
  status: RecurringExpenseStatus;
  reflectedMonthKeys: string[];
  createdAt: string;
  updatedAt: string;
};

export type Ingredient = {
  id: string;
  name: string;
  price: number;
  quantity: string;
  unit: IngredientUnit;
  purchaseDate: string;
  expiryDate: string;
  expiryType: ExpiryType;
  storageLocation: StorageLocation;
  openedStatus: OpenedStatus;
  status: IngredientStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type UserRecipe = {
  id: string;
  name: string;
  requiredIngredients: string[];
  optionalIngredients: string[];
  notes: string;
  cookingTimeMinutes: number;
  genre: string;
  easeLevel: RecipeRating;
  savingLevel: RecipeRating;
  createdAt: string;
  updatedAt: string;
};

export type CookedDishIngredient = {
  id: string;
  ingredientId: string | null;
  ingredientName: string;
  canonicalName: string;
  usedQuantity: number;
  unit: IngredientUnit;
  stockQuantityBefore: number | null;
  stockQuantityAfter: number | null;
  stockUnit: IngredientUnit | null;
  costAmount: number | null;
  costStatus: CookingCostStatus;
  note: string;
};

export type CookedDish = {
  id: string;
  name: string;
  cookedDate: string;
  servings: number;
  ingredients: CookedDishIngredient[];
  memo: string;
  referenceRecipeTitle: string;
  referenceRecipeUrl: string;
  photoUrl: string;
  totalCost: number | null;
  costPerServing: number | null;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdData = {
  schemaVersion: 1;
  transactions: Transaction[];
  ingredients: Ingredient[];
  userRecipes: UserRecipe[];
  userIngredientDictionary: IngredientDictionaryItem[];
  cookedDishes: CookedDish[];
  recurringExpenses: RecurringExpense[];
};

export const expenseCategories = [
  "食費",
  "日用品",
  "交通",
  "住居",
  "通信",
  "医療",
  "娯楽",
  "その他",
];

export const incomeCategories = ["給与", "副業", "臨時収入", "その他"];

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "現金",
  paypay: "PayPay",
  credit_card: "クレカ",
  transit_ic: "交通系IC",
  bank_transfer: "振込",
  other: "その他",
};

export const recurringExpenseFrequencyLabels: Record<RecurringExpenseFrequency, string> = {
  monthly: "毎月",
  weekly: "毎週",
  yearly: "毎年",
};

export const recurringExpenseStatusLabels: Record<RecurringExpenseStatus, string> = {
  active: "有効",
  paused: "停止中",
};

export const ingredientUnitOptions: IngredientUnit[] = [
  "個",
  "本",
  "袋",
  "パック",
  "g",
  "kg",
  "ml",
  "L",
  "その他",
];

export const expiryTypeLabels: Record<ExpiryType, string> = {
  best_before: "賞味期限",
  use_by: "消費期限",
  none: "期限なし",
};

export const storageLocationLabels: Record<StorageLocation, string> = {
  room: "常温",
  fridge: "冷蔵",
  freezer: "冷凍",
  vegetable_room: "野菜室",
  opened_fridge: "開封後冷蔵",
  other: "その他",
};

export const openedStatusLabels: Record<OpenedStatus, string> = {
  unopened: "未開封",
  opened: "開封済み",
};
