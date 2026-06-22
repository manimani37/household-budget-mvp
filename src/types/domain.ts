export type TransactionType = "expense" | "income";

export type PaymentMethod =
  | "cash"
  | "paypay"
  | "credit_card"
  | "transit_ic"
  | "bank_transfer"
  | "other";

export type IngredientStatus = "active" | "used" | "discarded";

export type StorageLocation = "fridge" | "freezer" | "pantry" | "other";

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

export type Ingredient = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  purchaseDate: string;
  expiryDate: string;
  storageLocation: StorageLocation;
  status: IngredientStatus;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdData = {
  schemaVersion: 1;
  transactions: Transaction[];
  ingredients: Ingredient[];
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

export const storageLocationLabels: Record<StorageLocation, string> = {
  fridge: "冷蔵",
  freezer: "冷凍",
  pantry: "常温",
  other: "その他",
};
