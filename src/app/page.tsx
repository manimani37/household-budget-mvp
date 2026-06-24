"use client";

import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileImage,
  Home,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Settings2,
  ScanText,
  Soup,
  Sprout,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import {
  getActiveIngredients,
  getExpiringIngredients,
  getIngredientExpiryInfo,
  getExpiryTone,
  getCookingMonthlySummary,
  getMonthlyCookedDishes,
  getMonthlySummary,
  getMonthlyTransactions,
  getNextRecurringPaymentDate,
  getRecurringMonthlySummary,
  getRecurringOccurrencesForMonth,
  getUpcomingRecurringExpenses,
} from "@/lib/calculations";
import {
  applyCookedDishToStock,
  calculateCookedDishIngredients,
  costStatusLabel,
} from "@/lib/cooking";
import type { CookingIngredientInput } from "@/lib/cooking";
import { currentMonthKey, daysUntil, formatShortDate, formatYen, todayIso, toIsoDate } from "@/lib/date";
import { buildExternalRecipeSearchIngredients } from "@/lib/externalRecipes";
import type { ExternalRecipe } from "@/lib/externalRecipes";
import {
  getCanonicalIngredient,
  initialIngredientDictionary,
  mergeIngredientDictionaries,
} from "@/lib/ingredients";
import {
  createId,
  emptyHouseholdData,
  LocalStorageHouseholdRepository,
} from "@/lib/repository";
import { buildRecipeSuggestions } from "@/lib/recipes";
import type { RecipeSuggestion } from "@/lib/recipes";
import type {
  CookedDish,
  HouseholdData,
  Ingredient,
  IngredientDictionaryItem,
  IngredientUnit,
  IngredientStatus,
  ExpiryType,
  OpenedStatus,
  PaymentMethod,
  RecurringExpense,
  RecurringExpenseFrequency,
  RecurringExpenseStatus,
  RecipeRating,
  StorageLocation,
  Transaction,
  TransactionType,
  UserRecipe,
} from "@/types/domain";
import {
  expenseCategories,
  expiryTypeLabels,
  ingredientUnitOptions,
  incomeCategories,
  openedStatusLabels,
  paymentMethodLabels,
  recurringExpenseFrequencyLabels,
  recurringExpenseStatusLabels,
  storageLocationLabels,
} from "@/types/domain";

type Tab = "home" | "record" | "recurring" | "foods" | "recipes" | "settings";

type RecordMode = "manual" | "receipt";

type ExternalRecipeStatus = "idle" | "loading" | "ready" | "error";

type TransactionFormState = {
  type: TransactionType;
  amount: string;
  category: string;
  paymentMethod: PaymentMethod;
  date: string;
  memo: string;
  addToStock: boolean;
  stock: IngredientFormState;
};

type IngredientFormState = {
  name: string;
  price: string;
  quantity: string;
  unit: IngredientUnit;
  purchaseDate: string;
  expiryDate: string;
  expiryType: ExpiryType;
  storageLocation: StorageLocation;
  openedStatus: OpenedStatus;
  memo: string;
};

type RecipeFormState = {
  name: string;
  requiredIngredients: string;
  optionalIngredients: string;
  notes: string;
  cookingTimeMinutes: string;
  genre: string;
  easeLevel: string;
  savingLevel: string;
};

type IngredientDictionaryFormState = {
  displayName: string;
  aliases: string;
  category: string;
  storageType: StorageLocation;
  defaultExpiryDays: string;
  compatibleIngredients: string;
  recipeCategories: string;
  tags: string;
};

type RecurringExpenseFormState = {
  name: string;
  amount: string;
  category: string;
  frequency: RecurringExpenseFrequency;
  paymentDay: string;
  paymentMonth: string;
  paymentMethod: PaymentMethod;
  memo: string;
  status: RecurringExpenseStatus;
};

type CookingFormItemState = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  usedQuantity: string;
  unit: IngredientUnit;
  note: string;
};

type CookingFormState = {
  name: string;
  cookedDate: string;
  servings: string;
  memo: string;
  referenceRecipeTitle: string;
  referenceRecipeUrl: string;
  photoUrl: string;
  items: CookingFormItemState[];
};

type ReceiptItemDraft = {
  id: string;
  name: string;
  selected: boolean;
  price: string;
  quantity: string;
  unit: IngredientUnit;
  expiryDate: string;
  expiryType: ExpiryType;
  storageLocation: StorageLocation;
  openedStatus: OpenedStatus;
};

type ReceiptDraft = {
  storeName: string;
  date: string;
  totalAmount: string;
  category: string;
  paymentMethod: PaymentMethod;
  rawText: string;
  items: ReceiptItemDraft[];
};

const paymentMethods = Object.keys(paymentMethodLabels) as PaymentMethod[];
const recurringExpenseCategories = ["通信費", "サブスク", "交通費", "保険", "家賃", "光熱費", "教育", "その他"];
const recurringExpenseFrequencies: RecurringExpenseFrequency[] = ["monthly", "weekly", "yearly"];
const recurringExpenseStatuses: RecurringExpenseStatus[] = ["active", "paused"];
const weekdayLabels = ["日曜", "月曜", "火曜", "水曜", "木曜", "金曜", "土曜"];
const storageLocations = Object.keys(storageLocationLabels) as StorageLocation[];
const expiryTypes = Object.keys(expiryTypeLabels) as ExpiryType[];
const openedStatuses = Object.keys(openedStatusLabels) as OpenedStatus[];
const OCR_LANGUAGE = "jpn+eng";
const OCR_LANGUAGE_LABEL = "日本語 + 英語";
const OCR_LANG_PATH = "https://tessdata.projectnaptha.com/4.0.0";

function defaultTransactionForm(): TransactionFormState {
  return {
    type: "expense",
    amount: "",
    category: expenseCategories[0],
    paymentMethod: "cash",
    date: todayIso(),
    memo: "",
    addToStock: false,
    stock: defaultIngredientForm(),
  };
}

function defaultIngredientForm(): IngredientFormState {
  return {
    name: "",
    price: "",
    quantity: "1",
    unit: "個",
    purchaseDate: todayIso(),
    expiryDate: toIsoDate(addDays(new Date(), 3)),
    expiryType: "best_before",
    storageLocation: "fridge",
    openedStatus: "unopened",
    memo: "",
  };
}

function defaultRecipeForm(): RecipeFormState {
  return {
    name: "",
    requiredIngredients: "",
    optionalIngredients: "",
    notes: "",
    cookingTimeMinutes: "10",
    genre: "簡単料理",
    easeLevel: "4",
    savingLevel: "4",
  };
}

function defaultIngredientDictionaryForm(): IngredientDictionaryFormState {
  return {
    displayName: "",
    aliases: "",
    category: "未分類",
    storageType: "fridge",
    defaultExpiryDays: "7",
    compatibleIngredients: "",
    recipeCategories: "",
    tags: "",
  };
}

function defaultRecurringExpenseForm(): RecurringExpenseFormState {
  return {
    name: "",
    amount: "",
    category: recurringExpenseCategories[0],
    frequency: "monthly",
    paymentDay: "25",
    paymentMonth: "1",
    paymentMethod: "credit_card",
    memo: "",
    status: "active",
  };
}

function recurringExpenseFormFromItem(expense: RecurringExpense): RecurringExpenseFormState {
  return {
    name: expense.name,
    amount: expense.amount > 0 ? String(expense.amount) : "",
    category: expense.category,
    frequency: expense.frequency,
    paymentDay: String(expense.paymentDay),
    paymentMonth: String(expense.paymentMonth),
    paymentMethod: expense.paymentMethod,
    memo: expense.memo,
    status: expense.status,
  };
}

function formatRecurringPaymentSchedule(expense: RecurringExpense): string {
  if (expense.frequency === "weekly") {
    return `毎週${weekdayLabels[expense.paymentDay] ?? "曜日未設定"}`;
  }

  if (expense.frequency === "yearly") {
    return `毎年${expense.paymentMonth}月${expense.paymentDay}日`;
  }

  return `毎月${expense.paymentDay}日`;
}

function formatDaysUntilRecurring(days: number): string {
  if (days < 0) {
    return `${Math.abs(days)}日過ぎています`;
  }
  if (days === 0) {
    return "今日";
  }

  return `あと${days}日`;
}

function defaultCookingForm(): CookingFormState {
  return {
    name: "",
    cookedDate: todayIso(),
    servings: "1",
    memo: "",
    referenceRecipeTitle: "",
    referenceRecipeUrl: "",
    photoUrl: "",
    items: [defaultCookingFormItem()],
  };
}

function defaultCookingFormItem(name = ""): CookingFormItemState {
  return {
    id: createId("cook_item"),
    ingredientId: "",
    ingredientName: name,
    usedQuantity: "",
    unit: "個",
    note: "",
  };
}

function defaultReceiptDraft(): ReceiptDraft {
  return {
    storeName: "",
    date: todayIso(),
    totalAmount: "",
    category: "食費",
    paymentMethod: "cash",
    rawText: "",
    items: [],
  };
}

function parsePrice(value: string): number {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function buildIngredientFromForm(form: IngredientFormState, now: string): Ingredient | null {
  const name = form.name.trim();
  if (!name) {
    return null;
  }

  return {
    id: createId("food"),
    name,
    price: parsePrice(form.price),
    quantity: form.quantity.trim() || "1",
    unit: form.unit,
    purchaseDate: form.purchaseDate || todayIso(),
    expiryDate: form.expiryType === "none" ? "" : form.expiryDate,
    expiryType: form.expiryType,
    storageLocation: form.storageLocation,
    openedStatus: form.openedStatus,
    status: "active",
    memo: form.memo.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

function buildUserRecipeFromForm(form: RecipeFormState, now: string): UserRecipe | null {
  const name = form.name.trim();
  const requiredIngredients = splitRecipeIngredients(form.requiredIngredients);
  if (!name || requiredIngredients.length === 0) {
    return null;
  }

  const cookingTimeMinutes = Math.max(1, Math.round(Number(form.cookingTimeMinutes) || 10));

  return {
    id: createId("recipe"),
    name,
    requiredIngredients,
    optionalIngredients: splitRecipeIngredients(form.optionalIngredients),
    notes: form.notes.trim(),
    cookingTimeMinutes,
    genre: form.genre.trim() || "自作",
    easeLevel: normalizeRecipeRating(form.easeLevel),
    savingLevel: normalizeRecipeRating(form.savingLevel),
    createdAt: now,
    updatedAt: now,
  };
}

function buildIngredientDictionaryItemFromForm(
  form: IngredientDictionaryFormState,
  now: string,
): IngredientDictionaryItem | null {
  const displayName = form.displayName.trim();
  if (!displayName) {
    return null;
  }

  const defaultExpiryDays = Math.max(0, Math.round(Number(form.defaultExpiryDays) || 7));

  return {
    id: createId("ingredient_dict"),
    displayName,
    aliases: splitDictionaryValues(form.aliases),
    category: form.category.trim() || "未分類",
    storageType: form.storageType,
    defaultExpiryDays,
    compatibleIngredients: splitDictionaryValues(form.compatibleIngredients),
    recipeCategories: splitDictionaryValues(form.recipeCategories),
    tags: splitDictionaryValues(form.tags),
    groupId: createId("ingredient_group"),
    isUserDefined: true,
    createdAt: now,
    updatedAt: now,
  };
}

function splitRecipeIngredients(value: string): string[] {
  return splitDictionaryValues(value);
}

function splitDictionaryValues(value: string): string[] {
  return value
    .split(/[\n,、]+/)
    .map((item) => item.trim())
    .filter((item, index, array) => item && array.indexOf(item) === index);
}

function ingredientDictionaryFormFromItem(item: IngredientDictionaryItem): IngredientDictionaryFormState {
  return {
    displayName: item.displayName,
    aliases: item.aliases.join("、"),
    category: item.category,
    storageType: item.storageType,
    defaultExpiryDays: String(item.defaultExpiryDays),
    compatibleIngredients: item.compatibleIngredients.join("、"),
    recipeCategories: item.recipeCategories.join("、"),
    tags: item.tags.join("、"),
  };
}

function cookingInputsFromForm(form: CookingFormState): CookingIngredientInput[] {
  return form.items.map((item) => ({
    id: item.id,
    ingredientId: item.ingredientId,
    ingredientName: item.ingredientName.trim(),
    usedQuantity: Number(item.usedQuantity),
    unit: item.unit,
    note: item.note.trim(),
  }));
}

function normalizeRecipeRating(value: string): RecipeRating {
  const rating = Math.round(Number(value));
  if (rating >= 1 && rating <= 5) {
    return rating as RecipeRating;
  }

  return 3;
}

function stockFormFromTransaction(form: TransactionFormState): IngredientFormState {
  return {
    ...form.stock,
    name: form.stock.name || form.memo,
    price: form.stock.price || form.amount,
    purchaseDate: form.stock.purchaseDate || form.date || todayIso(),
  };
}

function parseReceiptText(rawText: string): ReceiptDraft {
  const lines = normalizeReceiptLines(rawText);
  const date = extractReceiptDate(lines) ?? todayIso();
  const totalAmount = extractReceiptTotal(lines);
  const items = extractReceiptItems(lines, date);

  return {
    ...defaultReceiptDraft(),
    rawText,
    storeName: extractStoreName(lines),
    date,
    totalAmount: totalAmount ? String(totalAmount) : "",
    items,
  };
}

function normalizeReceiptLines(rawText: string): string[] {
  return rawText
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/[|｜]/g, " ")
        .replace(/[‐‑‒–—―ーｰ]/g, "-")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function extractStoreName(lines: string[]): string {
  const ignored = /(領収|レシート|receipt|tel|電話|登録番号|住所|合計|小計|釣銭|現金|クレジット|visa|master|税込|税)/i;
  const candidate = lines.find((line) => {
    const hasAmount = extractAmounts(line).length > 0;
    return !ignored.test(line) && !hasAmount && !parseDateLine(line) && line.length >= 2 && line.length <= 28;
  });

  return candidate ?? "";
}

function extractReceiptDate(lines: string[]): string | null {
  for (const line of lines) {
    const parsed = parseDateLine(line);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseDateLine(line: string): string | null {
  const match = line.match(/(20\d{2}|\d{2})[\/.\-年]\s*(\d{1,2})[\/.\-月]\s*(\d{1,2})/);
  if (!match) {
    return null;
  }

  const rawYear = Number(match[1]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractReceiptTotal(lines: string[]): number | null {
  const scoredCandidates: Array<{ amount: number; score: number; lineIndex: number }> = [];
  const totalPatterns: Array<{ pattern: RegExp; score: number }> = [
    { pattern: /(総合計|税込合計|お買上計|お買い上げ計|お支払金額|お支払い金額|支払金額)/, score: 100 },
    { pattern: /(?:^|\s)(合計|合 計|計)(?:\s|[:：]|[¥￥]|\d|$)/, score: 90 },
    { pattern: /(税込|税込み|内税|消費税込)/, score: 70 },
    { pattern: /(小計|小 計)/, score: 45 },
  ];
  const negativePatterns = /(釣銭|お釣|預り|お預り|預かり|現金|カード|クレジット|ポイント|値引|割引|消費税|対象|税率|税額)/;

  lines.forEach((line, index) => {
    const amounts = extractAmounts(line);
    const nextAmounts = amounts.length === 0 ? extractAmounts(lines[index + 1] ?? "") : [];
    const lineAmounts = amounts.length > 0 ? amounts : nextAmounts;
    if (lineAmounts.length === 0) {
      return;
    }

    const keywordScore = totalPatterns.reduce((score, candidate) => {
      return candidate.pattern.test(line) ? Math.max(score, candidate.score) : score;
    }, 0);
    if (keywordScore === 0) {
      return;
    }

    const score = keywordScore - (negativePatterns.test(line) ? 35 : 0);
    if (score <= 0) {
      return;
    }

    scoredCandidates.push(
      ...lineAmounts.map((amount) => ({
        amount,
        score,
        lineIndex: index,
      })),
    );
  });

  if (scoredCandidates.length > 0) {
    return scoredCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.amount !== a.amount) {
        return b.amount - a.amount;
      }
      return b.lineIndex - a.lineIndex;
    })[0].amount;
  }

  const allAmounts = lines
    .filter((line) => !negativePatterns.test(line))
    .flatMap((line) => extractAmounts(line));
  return allAmounts.length > 0 ? Math.max(...allAmounts) : null;
}

function extractAmounts(line: string): number[] {
  const normalizedLine = normalizeOcrDigits(line)
    .replace(/[oO]/g, "0")
    .replace(/[lI]/g, "1");
  const matches = normalizedLine.matchAll(/(?:[¥￥])?\s*([0-9]{1,3}(?:[,，][0-9]{3})+|[0-9]{2,7})(?:\s*円)?/g);
  return Array.from(matches)
    .map((match) => normalizeNumber(match[1]))
    .filter((amount) => amount >= 10 && amount <= 999_999);
}

function normalizeNumber(value: string): number {
  const normalized = value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[,，]/g, "");
  return Number(normalized);
}

function normalizeOcrDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function extractReceiptItems(lines: string[], receiptDate: string): ReceiptItemDraft[] {
  const ignored = /(合計|総合計|小計|消費税|税率|税額|税込|税|対象|釣銭|お釣|預り|お預り|預かり|現金|カード|クレジット|paypay|ポイント|値引|割引|領収|レシート|receipt|tel|電話|登録番号|住所|お買上|お買い上げ|明細|No\.|番号|担当|レジ|取引|精算|支払|支払い|合 計|小 計)/i;
  const noisyLine = /^[\d\s\-:：\/.,，]+$/;
  const candidates = lines
    .map(cleanReceiptItemLine)
    .filter((line) => line.length >= 2 && line.length <= 36)
    .filter((line) => !ignored.test(line))
    .filter((line) => !noisyLine.test(line))
    .filter((line) => !parseDateLine(line))
    .filter((line, index, array) => array.indexOf(line) === index)
    .slice(0, 12);

  return candidates.map((name) => ({
    id: createId("receipt_item"),
    name,
    selected: looksLikeFood(name),
    price: "",
    quantity: "1",
    unit: "個",
    expiryDate: toIsoDate(addDays(new Date(`${receiptDate}T00:00:00`), 3)),
    expiryType: "best_before",
    storageLocation: "fridge",
    openedStatus: "unopened",
  }));
}

function cleanReceiptItemLine(line: string): string {
  return normalizeOcrDigits(line)
    .replace(/^[*＊※軽内外\s]+/, "")
    .replace(/\s+[x×]\s*\d+.*$/i, "")
    .replace(/\s+\d+点.*$/, "")
    .replace(/\s+[¥￥]?\s*\d{1,3}(?:[,，]\d{3})+円?\s*$/, "")
    .replace(/\s+[¥￥]?\s*\d{2,7}円?\s*$/, "")
    .replace(/[¥￥]\s*\d{2,7}.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeFood(name: string): boolean {
  const foodKeywords = [
    "肉",
    "豚",
    "牛",
    "鶏",
    "魚",
    "卵",
    "豆腐",
    "牛乳",
    "ヨーグルト",
    "チーズ",
    "野菜",
    "玉ねぎ",
    "にんじん",
    "人参",
    "じゃが",
    "キャベツ",
    "レタス",
    "トマト",
    "きゅうり",
    "大根",
    "白菜",
    "ねぎ",
    "ほうれん草",
    "小松菜",
    "もやし",
    "きのこ",
    "米",
    "パン",
    "麺",
    "うどん",
    "そば",
    "パスタ",
    "バナナ",
    "りんご",
    "みかん",
  ];

  return foodKeywords.some((keyword) => name.includes(keyword));
}

export default function HomePage() {
  const repository = useMemo(() => new LocalStorageHouseholdRepository(), []);
  const [data, setData] = useState<HouseholdData>(emptyHouseholdData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(
    defaultTransactionForm,
  );
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [recurringExpenseForm, setRecurringExpenseForm] =
    useState<RecurringExpenseFormState>(defaultRecurringExpenseForm);
  const [editingRecurringExpenseId, setEditingRecurringExpenseId] = useState<string | null>(null);
  const [ingredientForm, setIngredientForm] =
    useState<IngredientFormState>(defaultIngredientForm);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [recipeForm, setRecipeForm] = useState<RecipeFormState>(defaultRecipeForm);
  const [externalRecipes, setExternalRecipes] = useState<ExternalRecipe[]>([]);
  const [externalRecipeStatus, setExternalRecipeStatus] =
    useState<ExternalRecipeStatus>("idle");
  const [externalRecipeMessage, setExternalRecipeMessage] = useState("");
  const [ingredientDictionaryForm, setIngredientDictionaryForm] =
    useState<IngredientDictionaryFormState>(defaultIngredientDictionaryForm);
  const [editingIngredientDictionaryId, setEditingIngredientDictionaryId] = useState<string | null>(null);
  const [cookingForm, setCookingForm] = useState<CookingFormState>(defaultCookingForm);
  const [selectedCookedDishId, setSelectedCookedDishId] = useState<string | null>(null);

  useEffect(() => {
    repository.load().then((savedData) => {
      setData(savedData);
      setIsLoaded(true);
    });
  }, [repository]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    repository.save(data);
  }, [data, isLoaded, repository]);

  const monthlySummary = useMemo(
    () => getMonthlySummary(data, selectedMonth),
    [data, selectedMonth],
  );
  const monthlyTransactions = useMemo(
    () => getMonthlyTransactions(data.transactions, selectedMonth),
    [data.transactions, selectedMonth],
  );
  const recurringSummary = useMemo(
    () => getRecurringMonthlySummary(data.recurringExpenses, selectedMonth),
    [data.recurringExpenses, selectedMonth],
  );
  const upcomingRecurringExpenses = useMemo(
    () => getUpcomingRecurringExpenses(data.recurringExpenses, 8),
    [data.recurringExpenses],
  );
  const monthlyCookedDishes = useMemo(
    () => getMonthlyCookedDishes(data.cookedDishes, selectedMonth),
    [data.cookedDishes, selectedMonth],
  );
  const cookingSummary = useMemo(
    () => getCookingMonthlySummary(data.cookedDishes, selectedMonth),
    [data.cookedDishes, selectedMonth],
  );
  const activeIngredients = useMemo(
    () => getActiveIngredients(data.ingredients),
    [data.ingredients],
  );
  const expiringIngredients = useMemo(
    () => getExpiringIngredients(data.ingredients, 5),
    [data.ingredients],
  );
  const recipes = useMemo(
    () => buildRecipeSuggestions(data.ingredients, data.userRecipes, data.userIngredientDictionary),
    [data.ingredients, data.userRecipes, data.userIngredientDictionary],
  );
  const ingredientDictionary = useMemo(
    () => mergeIngredientDictionaries(data.userIngredientDictionary),
    [data.userIngredientDictionary],
  );
  const externalRecipeIngredients = useMemo(
    () => buildExternalRecipeSearchIngredients(activeIngredients, data.userIngredientDictionary),
    [activeIngredients, data.userIngredientDictionary],
  );
  const unclassifiedIngredients = useMemo(
    () =>
      activeIngredients.filter(
        (ingredient) => getCanonicalIngredient(ingredient.name, ingredientDictionary).isUnclassified,
      ),
    [activeIngredients, ingredientDictionary],
  );
  const cookingPreview = useMemo(
    () =>
      calculateCookedDishIngredients({
        inputs: cookingInputsFromForm(cookingForm),
        stockIngredients: activeIngredients,
        userIngredientDictionary: data.userIngredientDictionary,
      }),
    [activeIngredients, cookingForm, data.userIngredientDictionary],
  );
  const expenseByCategory = useMemo(() => {
    return monthlyTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce<Record<string, number>>((result, transaction) => {
        result[transaction.category] =
          (result[transaction.category] ?? 0) + transaction.amount;
        return result;
      }, {});
  }, [monthlyTransactions]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (externalRecipeIngredients.length === 0) {
      setExternalRecipes([]);
      setExternalRecipeStatus("idle");
      setExternalRecipeMessage("");
      return;
    }

    const controller = new AbortController();
    setExternalRecipeStatus("loading");
    setExternalRecipeMessage("");

    fetch("/api/external-recipes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ingredients: externalRecipeIngredients,
        userIngredientDictionary: data.userIngredientDictionary,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`External recipe API failed: ${response.status}`);
        }

        return response.json() as Promise<{
          recipes?: ExternalRecipe[];
          message?: string;
        }>;
      })
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }

        setExternalRecipes(Array.isArray(result.recipes) ? result.recipes : []);
        setExternalRecipeMessage(result.message ?? "");
        setExternalRecipeStatus(result.recipes && result.recipes.length > 0 ? "ready" : "error");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to load external recipes", error);
        setExternalRecipes([]);
        setExternalRecipeStatus("error");
        setExternalRecipeMessage("外部レシピを取得できませんでした。手持ちレシピから提案します。");
      });

    return () => {
      controller.abort();
    };
  }, [data.userIngredientDictionary, externalRecipeIngredients, isLoaded]);

  const hasAnyData =
    data.transactions.length > 0 ||
    data.ingredients.length > 0 ||
    data.userRecipes.length > 0 ||
    data.userIngredientDictionary.length > 0 ||
    data.cookedDishes.length > 0 ||
    data.recurringExpenses.length > 0;
  const editingTransaction = editingTransactionId
    ? data.transactions.find((transaction) => transaction.id === editingTransactionId)
    : null;
  const editingRecurringExpense = editingRecurringExpenseId
    ? data.recurringExpenses.find((expense) => expense.id === editingRecurringExpenseId)
    : null;
  const editingIngredient = editingIngredientId
    ? data.ingredients.find((ingredient) => ingredient.id === editingIngredientId)
    : null;
  const transactionCategories =
    transactionForm.type === "expense" ? expenseCategories : incomeCategories;

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(transactionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const now = new Date().toISOString();
    const transactionValues = {
      type: transactionForm.type,
      amount,
      category: transactionForm.category,
      paymentMethod: transactionForm.paymentMethod,
      date: transactionForm.date,
      memo: transactionForm.memo.trim(),
      updatedAt: now,
    };

    if (editingTransactionId) {
      setData((current) => ({
        ...current,
        transactions: current.transactions.map((transaction) =>
          transaction.id === editingTransactionId
            ? {
                ...transaction,
                ...transactionValues,
              }
            : transaction,
        ),
      }));
      setEditingTransactionId(null);
      setTransactionForm(defaultTransactionForm());
      return;
    }

    const transaction: Transaction = {
      id: createId("txn"),
      ...transactionValues,
      createdAt: now,
    };
    const stockIngredient = transactionForm.addToStock
      ? buildIngredientFromForm(
          {
            ...stockFormFromTransaction(transactionForm),
            price: transactionForm.stock.price || transactionForm.amount,
            purchaseDate: transactionForm.stock.purchaseDate || transactionForm.date,
          },
          now,
        )
      : null;

    setData((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
      ingredients: stockIngredient ? [stockIngredient, ...current.ingredients] : current.ingredients,
    }));
    setTransactionForm(defaultTransactionForm());
  }

  function addRecurringExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(recurringExpenseForm.amount);
    if (!recurringExpenseForm.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const now = new Date().toISOString();
    const frequency = recurringExpenseForm.frequency;
    const paymentDayValue = Math.round(Number(recurringExpenseForm.paymentDay));
    const paymentMonthValue = Math.round(Number(recurringExpenseForm.paymentMonth));
    const paymentDay =
      frequency === "weekly"
        ? Math.min(6, Math.max(0, Number.isFinite(paymentDayValue) ? paymentDayValue : 1))
        : Math.min(31, Math.max(1, Number.isFinite(paymentDayValue) ? paymentDayValue : 1));
    const paymentMonth = Math.min(12, Math.max(1, Number.isFinite(paymentMonthValue) ? paymentMonthValue : 1));
    const expenseValues = {
      name: recurringExpenseForm.name.trim(),
      amount,
      category: recurringExpenseForm.category.trim() || "その他",
      frequency,
      paymentDay,
      paymentMonth,
      paymentMethod: recurringExpenseForm.paymentMethod,
      memo: recurringExpenseForm.memo.trim(),
      status: recurringExpenseForm.status,
      updatedAt: now,
    };

    if (editingRecurringExpenseId) {
      setData((current) => ({
        ...current,
        recurringExpenses: current.recurringExpenses.map((expense) =>
          expense.id === editingRecurringExpenseId
            ? {
                ...expense,
                ...expenseValues,
              }
            : expense,
        ),
      }));
      setEditingRecurringExpenseId(null);
      setRecurringExpenseForm(defaultRecurringExpenseForm());
      return;
    }

    const expense: RecurringExpense = {
      id: createId("recurring"),
      ...expenseValues,
      reflectedMonthKeys: [],
      createdAt: now,
    };

    setData((current) => ({
      ...current,
      recurringExpenses: [expense, ...current.recurringExpenses],
    }));
    setRecurringExpenseForm(defaultRecurringExpenseForm());
  }

  function startEditRecurringExpense(expense: RecurringExpense) {
    setRecurringExpenseForm(recurringExpenseFormFromItem(expense));
    setEditingRecurringExpenseId(expense.id);
    setActiveTab("recurring");
  }

  function cancelRecurringExpenseEdit() {
    setEditingRecurringExpenseId(null);
    setRecurringExpenseForm(defaultRecurringExpenseForm());
  }

  function deleteRecurringExpense(id: string) {
    if (!window.confirm("この定期支出を削除しますか？")) {
      return;
    }

    setData((current) => ({
      ...current,
      recurringExpenses: current.recurringExpenses.filter((expense) => expense.id !== id),
    }));

    if (editingRecurringExpenseId === id) {
      cancelRecurringExpenseEdit();
    }
  }

  function toggleRecurringExpenseStatus(id: string) {
    const now = new Date().toISOString();
    setData((current) => ({
      ...current,
      recurringExpenses: current.recurringExpenses.map((expense) =>
        expense.id === id
          ? {
              ...expense,
              status: expense.status === "active" ? "paused" : "active",
              updatedAt: now,
            }
          : expense,
      ),
    }));
  }

  function reflectRecurringExpensesToTransactions() {
    const targetExpenses = data.recurringExpenses.filter(
      (expense) =>
        expense.status === "active" &&
        !expense.reflectedMonthKeys.includes(selectedMonth) &&
        getRecurringOccurrencesForMonth(expense, selectedMonth).length > 0,
    );
    if (targetExpenses.length === 0) {
      window.alert("反映できる未反映の定期支出はありません。");
      return;
    }

    const transactionCount = targetExpenses.reduce(
      (count, expense) => count + getRecurringOccurrencesForMonth(expense, selectedMonth).length,
      0,
    );
    if (!window.confirm(`${selectedMonth} の定期支出 ${transactionCount}件を通常の支出記録に追加しますか？`)) {
      return;
    }

    const now = new Date().toISOString();
    const transactions: Transaction[] = targetExpenses.flatMap((expense) =>
      getRecurringOccurrencesForMonth(expense, selectedMonth).map((date) => ({
        id: createId("txn"),
        type: "expense",
        amount: expense.amount,
        category: expense.category,
        paymentMethod: expense.paymentMethod,
        date,
        memo: expense.memo ? `定期支出: ${expense.name} / ${expense.memo}` : `定期支出: ${expense.name}`,
        createdAt: now,
        updatedAt: now,
      })),
    );

    setData((current) => ({
      ...current,
      transactions: [...transactions, ...current.transactions],
      recurringExpenses: current.recurringExpenses.map((expense) =>
        targetExpenses.some((target) => target.id === expense.id)
          ? {
              ...expense,
              reflectedMonthKeys: [...expense.reflectedMonthKeys, selectedMonth],
              updatedAt: now,
            }
          : expense,
      ),
    }));
  }

  function addIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = new Date().toISOString();
    const ingredient = buildIngredientFromForm(ingredientForm, now);
    if (!ingredient) {
      return;
    }

    if (editingIngredientId) {
      setData((current) => ({
        ...current,
        ingredients: current.ingredients.map((currentIngredient) =>
          currentIngredient.id === editingIngredientId
            ? {
                ...currentIngredient,
                ...ingredient,
                id: currentIngredient.id,
                status: currentIngredient.status,
                createdAt: currentIngredient.createdAt,
                updatedAt: now,
              }
            : currentIngredient,
        ),
      }));
      setEditingIngredientId(null);
      setIngredientForm(defaultIngredientForm());
      return;
    }

    setData((current) => ({
      ...current,
      ingredients: [ingredient, ...current.ingredients],
    }));
    setIngredientForm(defaultIngredientForm());
  }

  function addReceiptDraft(draft: ReceiptDraft) {
    const amount = Number(draft.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: createId("txn"),
      type: "expense",
      amount,
      category: draft.category || "食費",
      paymentMethod: draft.paymentMethod,
      date: draft.date || todayIso(),
      memo: draft.storeName ? `レシートOCR: ${draft.storeName}` : "レシートOCR",
      createdAt: now,
      updatedAt: now,
    };
    const ingredients: Ingredient[] = draft.items
      .filter((item) => item.selected && item.name.trim())
      .map((item) =>
        buildIngredientFromForm(
          {
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            unit: item.unit,
            purchaseDate: draft.date || todayIso(),
            expiryDate: item.expiryType === "none" ? "" : item.expiryDate || toIsoDate(addDays(new Date(), 3)),
            expiryType: item.expiryType,
            storageLocation: item.storageLocation,
            openedStatus: item.openedStatus,
            memo: draft.storeName ? `レシートOCR: ${draft.storeName}` : "レシートOCR",
          },
          now,
        ),
      )
      .filter((ingredient): ingredient is Ingredient => Boolean(ingredient));

    setData((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
      ingredients: [...ingredients, ...current.ingredients],
    }));
  }

  function updateIngredientStatus(id: string, status: IngredientStatus) {
    setData((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient) =>
        ingredient.id === id
          ? {
              ...ingredient,
              status,
              updatedAt: new Date().toISOString(),
            }
          : ingredient,
      ),
    }));
  }

  function addUserRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = new Date().toISOString();
    const recipe = buildUserRecipeFromForm(recipeForm, now);
    if (!recipe) {
      return;
    }

    setData((current) => ({
      ...current,
      userRecipes: [recipe, ...current.userRecipes],
    }));
    setRecipeForm(defaultRecipeForm());
  }

  function deleteUserRecipe(id: string) {
    if (!window.confirm("このレシピを削除しますか？")) {
      return;
    }

    setData((current) => ({
      ...current,
      userRecipes: current.userRecipes.filter((recipe) => recipe.id !== id),
    }));
  }

  function addIngredientDictionaryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = new Date().toISOString();
    const item = buildIngredientDictionaryItemFromForm(ingredientDictionaryForm, now);
    if (!item) {
      return;
    }

    if (editingIngredientDictionaryId) {
      setData((current) => ({
        ...current,
        userIngredientDictionary: current.userIngredientDictionary.map((currentItem) =>
          currentItem.id === editingIngredientDictionaryId
            ? {
                ...currentItem,
                ...item,
                id: currentItem.id,
                groupId: currentItem.groupId || currentItem.id,
                createdAt: currentItem.createdAt,
                updatedAt: now,
              }
            : currentItem,
        ),
      }));
      setEditingIngredientDictionaryId(null);
      setIngredientDictionaryForm(defaultIngredientDictionaryForm());
      return;
    }

    setData((current) => ({
      ...current,
      userIngredientDictionary: [item, ...current.userIngredientDictionary],
    }));
    setIngredientDictionaryForm(defaultIngredientDictionaryForm());
  }

  function startEditIngredientDictionaryItem(item: IngredientDictionaryItem) {
    setIngredientDictionaryForm(ingredientDictionaryFormFromItem(item));
    setEditingIngredientDictionaryId(item.id);
    setActiveTab("foods");
  }

  function cancelIngredientDictionaryEdit() {
    setEditingIngredientDictionaryId(null);
    setIngredientDictionaryForm(defaultIngredientDictionaryForm());
  }

  function deleteIngredientDictionaryItem(id: string) {
    if (!window.confirm("この食材辞書を削除しますか？")) {
      return;
    }

    setData((current) => ({
      ...current,
      userIngredientDictionary: current.userIngredientDictionary.filter((item) => item.id !== id),
    }));

    if (editingIngredientDictionaryId === id) {
      cancelIngredientDictionaryEdit();
    }
  }

  function useIngredientAsDictionaryDraft(ingredient: Ingredient) {
    setIngredientDictionaryForm((current) => ({
      ...current,
      displayName: ingredient.name,
      aliases: current.aliases,
    }));
    setEditingIngredientDictionaryId(null);
    setActiveTab("foods");
  }

  function addCookingFormItem(name = "") {
    setCookingForm((current) => ({
      ...current,
      items: [...current.items, defaultCookingFormItem(name)],
    }));
  }

  function updateCookingFormItem(id: string, values: Partial<CookingFormItemState>) {
    setCookingForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...values } : item)),
    }));
  }

  function removeCookingFormItem(id: string) {
    setCookingForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== id) : current.items,
    }));
  }

  function startCookingFromRecipe({
    title,
    ingredients,
    recipeUrl = "",
  }: {
    title: string;
    ingredients: string[];
    recipeUrl?: string;
  }) {
    const nextItems = ingredients.length > 0 ? ingredients : [""];
    setCookingForm({
      ...defaultCookingForm(),
      name: title,
      referenceRecipeTitle: title,
      referenceRecipeUrl: recipeUrl,
      items: nextItems.map((ingredient) => ({
        ...defaultCookingFormItem(ingredient),
        usedQuantity: "1",
      })),
    });
    setActiveTab("recipes");
  }

  function addCookedDish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = cookingForm.name.trim();
    const servings = Number(cookingForm.servings);
    if (!name || !Number.isFinite(servings) || servings <= 0) {
      return;
    }

    const calculation = calculateCookedDishIngredients({
      inputs: cookingInputsFromForm(cookingForm),
      stockIngredients: activeIngredients,
      userIngredientDictionary: data.userIngredientDictionary,
    });
    const stockChanges = calculation.ingredients.filter(
      (ingredient) => ingredient.ingredientId && ingredient.stockQuantityAfter !== null,
    );
    const warningLines = [
      ...calculation.warnings,
      ...calculation.ingredients
        .filter((ingredient) => ingredient.costStatus !== "calculated")
        .map((ingredient) => `${ingredient.ingredientName}: ${costStatusLabel(ingredient.costStatus)}`),
    ];
    const confirmMessage = [
      "この料理を登録し、食材ストックを減らします。",
      ...stockChanges.map(
        (ingredient) =>
          `${ingredient.ingredientName}: ${ingredient.stockQuantityBefore ?? "-"}${ingredient.stockUnit ?? ""} -> ${ingredient.stockQuantityAfter ?? "-"}${ingredient.stockUnit ?? ""}`,
      ),
      ...(warningLines.length > 0 ? ["", "確認:", ...warningLines] : []),
    ].join("\n");

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const now = new Date().toISOString();
    const totalCost = calculation.totalCost;
    const dish: CookedDish = {
      id: createId("dish"),
      name,
      cookedDate: cookingForm.cookedDate || todayIso(),
      servings,
      ingredients: calculation.ingredients.map(({ exceedsStock, canDecrementStock, ...ingredient }) => ingredient),
      memo: cookingForm.memo.trim(),
      referenceRecipeTitle: cookingForm.referenceRecipeTitle.trim(),
      referenceRecipeUrl: cookingForm.referenceRecipeUrl.trim(),
      photoUrl: cookingForm.photoUrl.trim(),
      totalCost,
      costPerServing: totalCost !== null ? totalCost / servings : null,
      createdAt: now,
      updatedAt: now,
    };

    setData((current) => ({
      ...current,
      cookedDishes: [dish, ...current.cookedDishes],
      ingredients: applyCookedDishToStock(current.ingredients, dish.ingredients),
    }));
    setCookingForm(defaultCookingForm());
    setSelectedCookedDishId(dish.id);
  }

  function deleteCookedDish(id: string) {
    if (!window.confirm("この料理記録を削除しますか？食材ストックは戻しません。")) {
      return;
    }

    setData((current) => ({
      ...current,
      cookedDishes: current.cookedDishes.filter((dish) => dish.id !== id),
    }));

    if (selectedCookedDishId === id) {
      setSelectedCookedDishId(null);
    }
  }

  function startEditIngredient(ingredient: Ingredient) {
    setIngredientForm({
      name: ingredient.name,
      price: ingredient.price > 0 ? String(ingredient.price) : "",
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      purchaseDate: ingredient.purchaseDate,
      expiryDate: ingredient.expiryDate,
      expiryType: ingredient.expiryType,
      storageLocation: ingredient.storageLocation,
      openedStatus: ingredient.openedStatus,
      memo: ingredient.memo,
    });
    setEditingIngredientId(ingredient.id);
    setActiveTab("foods");
  }

  function cancelIngredientEdit() {
    setEditingIngredientId(null);
    setIngredientForm(defaultIngredientForm());
  }

  function deleteIngredient(id: string) {
    if (!window.confirm("この食材を削除しますか？")) {
      return;
    }

    setData((current) => ({
      ...current,
      ingredients: current.ingredients.filter((ingredient) => ingredient.id !== id),
    }));

    if (editingIngredientId === id) {
      cancelIngredientEdit();
    }
  }

  function deleteTransaction(id: string) {
    if (!window.confirm("この記録を削除しますか？")) {
      return;
    }

    setData((current) => ({
      ...current,
      transactions: current.transactions.filter((transaction) => transaction.id !== id),
    }));

    if (editingTransactionId === id) {
      setEditingTransactionId(null);
      setTransactionForm(defaultTransactionForm());
    }
  }

  function startEditTransaction(transaction: Transaction) {
    setTransactionForm({
      type: transaction.type,
      amount: String(transaction.amount),
      category: transaction.category,
      paymentMethod: transaction.paymentMethod,
      date: transaction.date,
      memo: transaction.memo,
      addToStock: false,
      stock: defaultIngredientForm(),
    });
    setEditingTransactionId(transaction.id);
    setActiveTab("record");
  }

  function cancelTransactionEdit() {
    setEditingTransactionId(null);
    setTransactionForm(defaultTransactionForm());
  }

  function addSampleData() {
    const now = new Date().toISOString();
    const sampleTransactions: Transaction[] = [
      {
        id: createId("txn"),
        type: "income",
        amount: 280000,
        category: "給与",
        paymentMethod: "bank_transfer",
        date: `${selectedMonth}-25`,
        memo: "サンプル給与",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId("txn"),
        type: "expense",
        amount: 3680,
        category: "食費",
        paymentMethod: "paypay",
        date: `${selectedMonth}-08`,
        memo: "スーパー",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId("txn"),
        type: "expense",
        amount: 1280,
        category: "日用品",
        paymentMethod: "cash",
        date: `${selectedMonth}-11`,
        memo: "洗剤など",
        createdAt: now,
        updatedAt: now,
      },
    ];
    const sampleIngredients: Ingredient[] = [
      {
        id: createId("food"),
        name: "豆腐",
        price: 128,
        quantity: "1",
        unit: "個",
        purchaseDate: todayIso(),
        expiryDate: toIsoDate(addDays(new Date(), 1)),
        expiryType: "use_by",
        storageLocation: "fridge",
        openedStatus: "unopened",
        status: "active",
        memo: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId("food"),
        name: "玉ねぎ",
        price: 198,
        quantity: "2",
        unit: "個",
        purchaseDate: todayIso(),
        expiryDate: toIsoDate(addDays(new Date(), 4)),
        expiryType: "best_before",
        storageLocation: "room",
        openedStatus: "unopened",
        status: "active",
        memo: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId("food"),
        name: "卵",
        price: 250,
        quantity: "6",
        unit: "個",
        purchaseDate: todayIso(),
        expiryDate: toIsoDate(addDays(new Date(), 5)),
        expiryType: "best_before",
        storageLocation: "fridge",
        openedStatus: "unopened",
        status: "active",
        memo: "",
        createdAt: now,
        updatedAt: now,
      },
    ];

    setData((current) => ({
      ...current,
      transactions: [...sampleTransactions, ...current.transactions],
      ingredients: [...sampleIngredients, ...current.ingredients],
    }));
  }

  function clearAllData() {
    if (!window.confirm("ブラウザ内のMVPデータをすべて削除しますか？")) {
      return;
    }

    setData(emptyHouseholdData);
    setEditingTransactionId(null);
    setTransactionForm(defaultTransactionForm());
    setEditingRecurringExpenseId(null);
    setRecurringExpenseForm(defaultRecurringExpenseForm());
    setEditingIngredientId(null);
    setIngredientForm(defaultIngredientForm());
    setRecipeForm(defaultRecipeForm());
    setEditingIngredientDictionaryId(null);
    setIngredientDictionaryForm(defaultIngredientDictionaryForm());
    setCookingForm(defaultCookingForm());
    setSelectedCookedDishId(null);
  }

  return (
    <main className="min-h-screen pb-[calc(6.75rem+env(safe-area-inset-bottom))] text-ink lg:pb-8">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-leaf">Local MVP</p>
            <h1 className="truncate text-lg font-bold sm:text-2xl">使い切り家計簿</h1>
          </div>
          <DesktopNav activeTab={activeTab} onChange={setActiveTab} />
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-sea/20 bg-white px-3 py-2 text-xs font-bold text-sea shadow-sm">
            <WalletCards className="h-4 w-4" aria-hidden />
            <span className="hidden min-[360px]:inline">ブラウザ保存</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0">
          {activeTab === "home" && (
            <DashboardView
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              summary={monthlySummary}
              expiringIngredients={expiringIngredients}
              recipes={recipes}
              recentTransactions={data.transactions.slice(0, 5)}
              hasAnyData={hasAnyData}
              onAddSampleData={addSampleData}
              onChangeTab={setActiveTab}
              onEditTransaction={startEditTransaction}
              onDeleteTransaction={deleteTransaction}
            />
          )}

          {activeTab === "record" && (
            <RecordView
              form={transactionForm}
              categories={transactionCategories}
              onSubmit={addTransaction}
              onChange={setTransactionForm}
              onRegisterReceipt={addReceiptDraft}
              isEditing={Boolean(editingTransaction)}
              onCancelEdit={cancelTransactionEdit}
            />
          )}

          {activeTab === "recurring" && (
            <RecurringExpensesView
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              form={recurringExpenseForm}
              expenses={data.recurringExpenses}
              summary={recurringSummary}
              upcomingExpenses={upcomingRecurringExpenses}
              isEditing={Boolean(editingRecurringExpense)}
              onSubmit={addRecurringExpense}
              onChange={setRecurringExpenseForm}
              onEditExpense={startEditRecurringExpense}
              onDeleteExpense={deleteRecurringExpense}
              onToggleStatus={toggleRecurringExpenseStatus}
              onCancelEdit={cancelRecurringExpenseEdit}
              onReflectToTransactions={reflectRecurringExpensesToTransactions}
            />
          )}

          {activeTab === "foods" && (
            <FoodsView
              form={ingredientForm}
              dictionaryForm={ingredientDictionaryForm}
              activeIngredients={activeIngredients}
              unclassifiedIngredients={unclassifiedIngredients}
              userIngredientDictionary={data.userIngredientDictionary}
              onSubmit={addIngredient}
              onChange={setIngredientForm}
              onDictionarySubmit={addIngredientDictionaryItem}
              onDictionaryChange={setIngredientDictionaryForm}
              onUpdateStatus={updateIngredientStatus}
              onEditIngredient={startEditIngredient}
              onDeleteIngredient={deleteIngredient}
              onEditDictionaryItem={startEditIngredientDictionaryItem}
              onDeleteDictionaryItem={deleteIngredientDictionaryItem}
              onCancelDictionaryEdit={cancelIngredientDictionaryEdit}
              onUseIngredientAsDictionaryDraft={useIngredientAsDictionaryDraft}
              isEditing={Boolean(editingIngredient)}
              onCancelEdit={cancelIngredientEdit}
              isDictionaryEditing={Boolean(editingIngredientDictionaryId)}
            />
          )}

          {activeTab === "recipes" && (
            <RecipesView
              expiringIngredients={expiringIngredients}
              recipes={recipes}
              externalRecipes={externalRecipes}
              externalRecipeStatus={externalRecipeStatus}
              externalRecipeMessage={externalRecipeMessage}
              recipeForm={recipeForm}
              userRecipes={data.userRecipes}
              cookingForm={cookingForm}
              cookingPreview={cookingPreview}
              activeIngredients={activeIngredients}
              cookedDishes={monthlyCookedDishes}
              cookingSummary={cookingSummary}
              selectedCookedDishId={selectedCookedDishId}
              onAddRecipe={addUserRecipe}
              onRecipeFormChange={setRecipeForm}
              onDeleteUserRecipe={deleteUserRecipe}
              onCookingSubmit={addCookedDish}
              onCookingFormChange={setCookingForm}
              onAddCookingItem={addCookingFormItem}
              onUpdateCookingItem={updateCookingFormItem}
              onRemoveCookingItem={removeCookingFormItem}
              onStartCookingFromRecipe={startCookingFromRecipe}
              onSelectCookedDish={setSelectedCookedDishId}
              onDeleteCookedDish={deleteCookedDish}
              onChangeTab={setActiveTab}
            />
          )}

          {activeTab === "settings" && (
            <SettingsView
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              summary={monthlySummary}
              monthlyTransactions={monthlyTransactions}
              expenseByCategory={expenseByCategory}
              onEditTransaction={startEditTransaction}
              onDeleteTransaction={deleteTransaction}
              onClearAllData={clearAllData}
            />
          )}
        </section>

        <aside className="hidden lg:block">
          <SidePanel
            activeIngredients={activeIngredients}
            recipes={recipes}
            onChangeTab={setActiveTab}
          />
        </aside>
      </div>

      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}

function DashboardView({
  selectedMonth,
  setSelectedMonth,
  summary,
  expiringIngredients,
  recipes,
  recentTransactions,
  hasAnyData,
  onAddSampleData,
  onChangeTab,
  onEditTransaction,
  onDeleteTransaction,
}: {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  summary: ReturnType<typeof getMonthlySummary>;
  expiringIngredients: Ingredient[];
  recipes: ReturnType<typeof buildRecipeSuggestions>;
  recentTransactions: Transaction[];
  hasAnyData: boolean;
  onAddSampleData: () => void;
  onChangeTab: (tab: Tab) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-leaf">今月の見通し</p>
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl">収支と食材をまとめて確認</h2>
        </div>
        <label className="w-full sm:w-44">
          <span className="mb-1 block text-sm font-bold text-ink/70">対象月</span>
          <input
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            type="month"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3 shadow-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="収入"
          value={formatYen(summary.income)}
          icon={TrendingUp}
          tone="leaf"
        />
        <MetricCard
          label="支出"
          value={formatYen(summary.expense)}
          icon={TrendingDown}
          tone="tomato"
        />
        <MetricCard
          label="残高"
          value={formatYen(summary.balance)}
          icon={CircleDollarSign}
          tone="sea"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionButton label="支出・収入を追加" icon={ReceiptText} onClick={() => onChangeTab("record")} />
        <ActionButton label="定期支出を見る" icon={CalendarClock} onClick={() => onChangeTab("recurring")} />
        <ActionButton label="食材を追加" icon={Sprout} onClick={() => onChangeTab("foods")} />
        <ActionButton label="レシピを見る" icon={Soup} onClick={() => onChangeTab("recipes")} />
      </div>

      {!hasAnyData && (
        <div className="rounded-lg border border-honey/30 bg-white p-4 shadow-soft">
          <p className="text-base font-bold">まずはサンプルで動きを確認できます</p>
          <p className="mt-1 text-sm leading-6 text-ink/70">
            支出、収入、期限付き食材を少しだけ入れて、月次集計とレシピ提案の流れを確認できます。
          </p>
          <button
            type="button"
            onClick={onAddSampleData}
            className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" aria-hidden />
            サンプルを追加
          </button>
        </div>
      )}

      <ExpiringSection ingredients={expiringIngredients} />
      <RecipeSection
        title="今日おすすめ"
        recipes={recipes.today}
        emptyText="食材を登録すると、期限と相性を見て提案します。"
      />
      <RecentTransactions
        transactions={recentTransactions}
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />
    </div>
  );
}

function RecordView({
  form,
  categories,
  onSubmit,
  onChange,
  onRegisterReceipt,
  isEditing,
  onCancelEdit,
}: {
  form: TransactionFormState;
  categories: string[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: TransactionFormState | ((current: TransactionFormState) => TransactionFormState)) => void;
  onRegisterReceipt: (draft: ReceiptDraft) => void;
  isEditing: boolean;
  onCancelEdit: () => void;
}) {
  const [mode, setMode] = useState<RecordMode>("manual");

  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Record" title="支出・収入を登録" />

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-ink/10 bg-white p-2 shadow-soft">
        <SegmentButton
          selected={mode === "manual"}
          label="手入力"
          icon={ReceiptText}
          onClick={() => setMode("manual")}
        />
        <SegmentButton
          selected={mode === "receipt"}
          label="レシート読み取り"
          icon={ScanText}
          onClick={() => setMode("receipt")}
        />
      </div>

      {mode === "manual" ? (
      <form onSubmit={onSubmit} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        {isEditing && (
          <div className="mb-5 rounded-lg border border-honey/30 bg-honey/10 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-ink">編集モード</p>
                <p className="mt-1 text-sm text-ink/65">
                  入力内容を変更して「更新する」を押すと、元の記録が更新されます。
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink/70"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <SegmentButton
            selected={form.type === "expense"}
            label="支出"
            icon={TrendingDown}
            onClick={() =>
              onChange((current) => ({
                ...current,
                type: "expense",
                category: expenseCategories[0],
              }))
            }
          />
          <SegmentButton
            selected={form.type === "income"}
            label="収入"
            icon={TrendingUp}
            onClick={() =>
              onChange((current) => ({
                ...current,
                type: "income",
                category: incomeCategories[0],
                addToStock: false,
              }))
            }
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">金額</span>
            <input
              required
              inputMode="numeric"
              min="1"
              value={form.amount}
              onChange={(event) =>
                onChange((current) => ({ ...current, amount: event.target.value }))
              }
              type="number"
              placeholder="例: 1200"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">日付</span>
            <input
              required
              value={form.date}
              onChange={(event) =>
                onChange((current) => ({ ...current, date: event.target.value }))
              }
              type="date"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">カテゴリ</span>
            <select
              value={form.category}
              onChange={(event) =>
                onChange((current) => ({ ...current, category: event.target.value }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">決済方法</span>
            <select
              value={form.paymentMethod}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  paymentMethod: event.target.value as PaymentMethod,
                }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabels[method]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold text-ink/70">メモ</span>
          <textarea
            value={form.memo}
            onChange={(event) =>
              onChange((current) => ({ ...current, memo: event.target.value }))
            }
            rows={3}
            placeholder="例: スーパー、昼食、臨時収入など"
            className="min-h-24 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>

        {!isEditing && form.type === "expense" && (
          <section className="mt-5 rounded-lg border border-leaf/20 bg-leaf/5 p-3 sm:p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.addToStock}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    addToStock: event.target.checked,
                    stock: event.target.checked ? stockFormFromTransaction(current) : current.stock,
                  }))
                }
                className="mt-1 h-5 w-5 accent-leaf"
              />
              <span>
                <span className="block font-bold text-ink">食材ストックにも追加する</span>
                <span className="mt-1 block text-sm leading-6 text-ink/65">
                  食費として記録しながら、期限や保存方法つきで食材ストックにも登録できます。
                </span>
              </span>
            </label>

            {form.addToStock && (
              <div className="mt-4 rounded-lg border border-ink/10 bg-white p-3">
                <FoodStockFields
                  form={form.stock}
                  onChange={(value) =>
                    onChange((current) => ({
                      ...current,
                      stock: typeof value === "function" ? value(current.stock) : value,
                    }))
                  }
                />
              </div>
            )}
          </section>
        )}

        <button
          type="submit"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
        >
          {isEditing ? <Pencil className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
          {isEditing ? "更新する" : "登録する"}
        </button>
      </form>
      ) : (
        <ReceiptScanner onRegister={onRegisterReceipt} />
      )}
    </div>
  );
}

function ReceiptScanner({ onRegister }: { onRegister: (draft: ReceiptDraft) => void }) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [draft, setDraft] = useState<ReceiptDraft>(defaultReceiptDraft);
  const [isReading, setIsReading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState("未実行");
  const [ocrError, setOcrError] = useState("");

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setOcrError("");
    setOcrProgress(0);
    setOcrStatus("画像選択済み");
    setDraft(defaultReceiptDraft());
  }

  async function runOcr() {
    if (!imageFile) {
      return;
    }

    setIsReading(true);
    setOcrError("");
    setOcrProgress(0);
    setOcrStatus(`OCR準備中: ${OCR_LANGUAGE}`);
    console.info("[Receipt OCR] language:", OCR_LANGUAGE, OCR_LANGUAGE_LABEL);
    console.info("[Receipt OCR] traineddata langPath:", OCR_LANG_PATH);

    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(imageFile, OCR_LANGUAGE, {
        langPath: OCR_LANG_PATH,
        logger: (message) => {
          console.info("[Receipt OCR]", message.status, message.progress);
          setOcrStatus(`${message.status} (${OCR_LANGUAGE})`);
          if (typeof message.progress === "number") {
            setOcrProgress(Math.round(message.progress * 100));
          }
        },
      });
      const text = result.data.text.trim();
      setDraft(parseReceiptText(text));
      setOcrStatus(`読み取り完了: ${OCR_LANGUAGE}`);
    } catch (error) {
      console.error("[Receipt OCR] failed", error);
      setOcrError("OCR読み取りに失敗しました。画像を明るく撮り直すか、手入力で補正してください。");
      setOcrStatus(`読み取り失敗: ${OCR_LANGUAGE}`);
    } finally {
      setIsReading(false);
    }
  }

  function reparseRawText() {
    setDraft((current) => {
      const reparsed = parseReceiptText(current.rawText);
      return {
        ...reparsed,
        category: current.category,
        paymentMethod: current.paymentMethod,
      };
    });
  }

  function updateItem(id: string, patch: Partial<ReceiptItemDraft>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  function addBlankItem() {
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: createId("receipt_item"),
          name: "",
          selected: true,
          price: "",
          quantity: "1",
          unit: "個",
          expiryDate: toIsoDate(addDays(new Date(current.date || todayIso()), 3)),
          expiryType: "best_before",
          storageLocation: "fridge",
          openedStatus: "unopened",
        },
      ],
    }));
  }

  function registerReceipt() {
    onRegister(draft);
    setDraft(defaultReceiptDraft());
    setImageFile(null);
    setImageUrl("");
    setOcrProgress(0);
    setOcrStatus("未実行");
  }

  const canRegister = Number(draft.totalAmount) > 0;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex items-center gap-2">
          <FileImage className="h-5 w-5 text-sea" aria-hidden />
          <h3 className="text-lg font-bold">レシート画像を選択</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          PCでは画像ファイルを選択できます。スマホではカメラ撮影または写真ライブラリから選べます。
        </p>
        <div className="mt-3 rounded-lg border border-sea/15 bg-sea/5 px-3 py-3 text-sm leading-6 text-ink/75">
          <p>
            OCR言語: <span className="font-bold text-sea">{OCR_LANGUAGE_LABEL}</span>{" "}
            <span className="font-mono text-xs">({OCR_LANGUAGE})</span>
          </p>
          <p className="break-all">
            traineddata: <span className="font-mono text-xs">{OCR_LANG_PATH}/jpn.traineddata.gz</span>
          </p>
          <p className="break-all">
            fallback: <span className="font-mono text-xs">{OCR_LANG_PATH}/eng.traineddata.gz</span>
          </p>
        </div>

        <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-sea/40 bg-paper px-4 py-6 text-center">
          <FileImage className="h-8 w-8 text-sea" aria-hidden />
          <span className="mt-2 font-bold text-sea">レシート画像を選ぶ</span>
          <span className="mt-1 text-xs text-ink/60">JPG / PNG などの画像に対応</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="sr-only"
          />
        </label>

        {imageUrl && (
          <div className="mt-4 overflow-hidden rounded-lg border border-ink/10 bg-paper">
            <img src={imageUrl} alt="選択したレシート" className="max-h-[420px] w-full object-contain" />
          </div>
        )}

        <button
          type="button"
          onClick={runOcr}
          disabled={!imageFile || isReading}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-ink/25 sm:w-auto"
        >
          {isReading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ScanText className="h-5 w-5" aria-hidden />}
          {isReading ? `読み取り中 ${ocrProgress}%` : "OCR読み取り開始"}
        </button>

        <p className="mt-3 text-sm font-bold text-ink/65">
          OCR状態: {ocrStatus}
        </p>

        {ocrError && (
          <p className="mt-3 rounded-lg border border-tomato/20 bg-tomato/10 px-3 py-2 text-sm font-bold text-tomato">
            {ocrError}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">読み取り結果の確認</h3>
            <p className="mt-1 text-sm text-ink/65">OCR精度は画像によって揺れるので、登録前に必ず修正してください。</p>
          </div>
          <button
            type="button"
            onClick={reparseRawText}
            disabled={!draft.rawText}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/15 px-3 py-2 text-sm font-bold text-ink/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ScanText className="h-4 w-4" aria-hidden />
            再推定
          </button>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold text-ink/70">生テキスト</span>
          <textarea
            value={draft.rawText}
            onChange={(event) => setDraft((current) => ({ ...current, rawText: event.target.value }))}
            rows={7}
            placeholder="OCR結果がここに表示されます"
            className="min-h-40 w-full resize-y rounded-lg border border-ink/15 bg-paper px-3 py-3 font-mono text-sm leading-6"
          />
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">店名</span>
            <input
              value={draft.storeName}
              onChange={(event) => setDraft((current) => ({ ...current, storeName: event.target.value }))}
              placeholder="例: スーパー〇〇"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">日付</span>
            <input
              value={draft.date}
              onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
              type="date"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">合計金額</span>
            <input
              value={draft.totalAmount}
              onChange={(event) => setDraft((current) => ({ ...current, totalAmount: event.target.value }))}
              inputMode="numeric"
              type="number"
              min="1"
              placeholder="例: 3480"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">決済方法</span>
            <select
              value={draft.paymentMethod}
              onChange={(event) =>
                setDraft((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabels[method]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">商品名一覧</h3>
            <p className="mt-1 text-sm text-ink/65">食材っぽいものにチェックを入れると、食材リストにも追加します。</p>
          </div>
          <button
            type="button"
            onClick={addBlankItem}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-ink/15 px-3 py-2 text-sm font-bold text-ink/70"
          >
            <Plus className="h-4 w-4" aria-hidden />
            追加
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {draft.items.length === 0 ? (
            <EmptyState text="OCR後に商品候補が表示されます。必要なら「追加」から手入力できます。" />
          ) : (
            draft.items.map((item) => (
              <article key={item.id} className="rounded-lg border border-ink/10 bg-paper p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`${item.name || "商品"}を食材に追加`}
                    checked={item.selected}
                    onChange={(event) => updateItem(item.id, { selected: event.target.checked })}
                    className="mt-3 h-5 w-5 accent-leaf"
                  />
                  <span className="grid flex-1 gap-3 sm:grid-cols-[1fr_96px_120px]">
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">商品名</span>
                      <input
                        aria-label="商品名"
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      />
                    </span>
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">金額</span>
                      <input
                        aria-label="金額"
                        value={item.price}
                        onChange={(event) => updateItem(item.id, { price: event.target.value })}
                        inputMode="numeric"
                        type="number"
                        min="0"
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      />
                    </span>
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">数量</span>
                      <input
                        aria-label="数量"
                        value={item.quantity}
                        onChange={(event) => updateItem(item.id, { quantity: event.target.value })}
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      />
                    </span>
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">単位</span>
                      <select
                        aria-label="単位"
                        value={item.unit}
                        onChange={(event) => updateItem(item.id, { unit: event.target.value as IngredientUnit })}
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      >
                        {ingredientUnitOptions.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">期限種類</span>
                      <select
                        aria-label="期限種類"
                        value={item.expiryType}
                        onChange={(event) =>
                          updateItem(item.id, {
                            expiryType: event.target.value as ExpiryType,
                            expiryDate:
                              event.target.value === "none"
                                ? ""
                                : item.expiryDate || toIsoDate(addDays(new Date(), 3)),
                          })
                        }
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      >
                        {expiryTypes.map((type) => (
                          <option key={type} value={type}>
                            {expiryTypeLabels[type]}
                          </option>
                        ))}
                      </select>
                    </span>
                    {item.expiryType !== "none" && (
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">期限日</span>
                      <input
                        aria-label="期限"
                        value={item.expiryDate}
                        onChange={(event) => updateItem(item.id, { expiryDate: event.target.value })}
                        type="date"
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      />
                    </span>
                    )}
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">保存</span>
                      <select
                        value={item.storageLocation}
                        onChange={(event) =>
                          updateItem(item.id, { storageLocation: event.target.value as StorageLocation })
                        }
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      >
                        {storageLocations.map((location) => (
                          <option key={location} value={location}>
                            {storageLocationLabels[location]}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">開封状態</span>
                      <select
                        value={item.openedStatus}
                        onChange={(event) => updateItem(item.id, { openedStatus: event.target.value as OpenedStatus })}
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      >
                        {openedStatuses.map((status) => (
                          <option key={status} value={status}>
                            {openedStatusLabels[status]}
                          </option>
                        ))}
                      </select>
                    </span>
                  </span>
                </div>
              </article>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={registerReceipt}
          disabled={!canRegister}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-ink/25 sm:w-auto"
        >
          <ReceiptText className="h-5 w-5" aria-hidden />
          支出として登録
        </button>
      </section>
    </div>
  );
}

function RecurringExpensesView({
  selectedMonth,
  setSelectedMonth,
  form,
  expenses,
  summary,
  upcomingExpenses,
  isEditing,
  onSubmit,
  onChange,
  onEditExpense,
  onDeleteExpense,
  onToggleStatus,
  onCancelEdit,
  onReflectToTransactions,
}: {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  form: RecurringExpenseFormState;
  expenses: RecurringExpense[];
  summary: ReturnType<typeof getRecurringMonthlySummary>;
  upcomingExpenses: ReturnType<typeof getUpcomingRecurringExpenses>;
  isEditing: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: RecurringExpenseFormState | ((current: RecurringExpenseFormState) => RecurringExpenseFormState)) => void;
  onEditExpense: (expense: RecurringExpense) => void;
  onDeleteExpense: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onCancelEdit: () => void;
  onReflectToTransactions: () => void;
}) {
  const categoryRows = Object.entries(summary.categoryTotals).sort((a, b) => b[1] - a[1]);
  const reflectedCount = expenses.filter((expense) => expense.reflectedMonthKeys.includes(selectedMonth)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading eyebrow="Fixed costs" title="定期支出" />
        <label className="w-full sm:w-44">
          <span className="mb-1 block text-sm font-bold text-ink/70">対象月</span>
          <input
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            type="month"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3 shadow-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="今月の定期支出" value={formatYen(summary.total)} icon={CalendarClock} tone="tomato" />
        <MetricCard label="有効な固定費" value={`${summary.activeCount}件`} icon={CheckCircle2} tone="leaf" />
        <MetricCard label="今月の発生回数" value={`${summary.occurrenceCount}回`} icon={ClipboardList} tone="sea" />
      </div>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">{isEditing ? "定期支出を編集" : "定期支出を登録"}</h3>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              毎月のスマホ代、サブスク、保険、家賃などを手入力で管理します。
            </p>
          </div>
          {isEditing && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink/70"
            >
              キャンセル
            </button>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-ink/70">支出名</span>
            <input
              required
              value={form.name}
              onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
              placeholder="例: スマホ代、Netflix、保険料"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">金額</span>
            <input
              required
              inputMode="numeric"
              min="1"
              value={form.amount}
              onChange={(event) => onChange((current) => ({ ...current, amount: event.target.value }))}
              type="number"
              placeholder="例: 2980"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">カテゴリ</span>
            <select
              value={form.category}
              onChange={(event) => onChange((current) => ({ ...current, category: event.target.value }))}
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            >
              {recurringExpenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">支払い頻度</span>
            <select
              value={form.frequency}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  frequency: event.target.value as RecurringExpenseFrequency,
                  paymentDay: event.target.value === "weekly" ? "1" : current.paymentDay,
                }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            >
              {recurringExpenseFrequencies.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {recurringExpenseFrequencyLabels[frequency]}
                </option>
              ))}
            </select>
          </label>
          {form.frequency === "yearly" && (
            <label>
              <span className="mb-1 block text-sm font-bold text-ink/70">支払い月</span>
              <select
                value={form.paymentMonth}
                onChange={(event) => onChange((current) => ({ ...current, paymentMonth: event.target.value }))}
                className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">
              {form.frequency === "weekly" ? "支払い曜日" : "支払日"}
            </span>
            {form.frequency === "weekly" ? (
              <select
                value={form.paymentDay}
                onChange={(event) => onChange((current) => ({ ...current, paymentDay: event.target.value }))}
                className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
              >
                {weekdayLabels.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                inputMode="numeric"
                min="1"
                max="31"
                value={form.paymentDay}
                onChange={(event) => onChange((current) => ({ ...current, paymentDay: event.target.value }))}
                type="number"
                className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
              />
            )}
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">支払い方法</span>
            <select
              value={form.paymentMethod}
              onChange={(event) =>
                onChange((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabels[method]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">状態</span>
            <select
              value={form.status}
              onChange={(event) =>
                onChange((current) => ({ ...current, status: event.target.value as RecurringExpenseStatus }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            >
              {recurringExpenseStatuses.map((status) => (
                <option key={status} value={status}>
                  {recurringExpenseStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-ink/70">メモ</span>
            <textarea
              value={form.memo}
              onChange={(event) => onChange((current) => ({ ...current, memo: event.target.value }))}
              rows={3}
              placeholder="契約更新日、見直し候補、家族分など"
              className="min-h-24 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
            >
              {isEditing ? <Pencil className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
              {isEditing ? "更新する" : "定期支出を登録"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">今月分を支出に反映</h3>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              自動では追加しません。必要な月だけ手動で通常の支出記録に追加できます。
            </p>
          </div>
          <button
            type="button"
            onClick={onReflectToTransactions}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-bold text-white"
          >
            <ReceiptText className="h-4 w-4" aria-hidden />
            {selectedMonth}分を反映
          </button>
        </div>
        <p className="mt-3 text-sm text-ink/60">反映済みの定期支出: {reflectedCount}件</p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <h3 className="text-lg font-bold">支払日が近いもの</h3>
          <div className="mt-3 grid gap-2">
            {upcomingExpenses.length === 0 ? (
              <EmptyState text="有効な定期支出はまだありません。" />
            ) : (
              upcomingExpenses.map(({ expense, dueDate, daysUntilDue }) => (
                <div key={expense.id} className="rounded-lg border border-ink/10 bg-paper p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{expense.name}</p>
                      <p className="mt-1 text-sm text-ink/60">
                        {formatShortDate(dueDate)} / {formatDaysUntilRecurring(daysUntilDue)}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold text-tomato">{formatYen(expense.amount)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <h3 className="text-lg font-bold">カテゴリ別合計</h3>
          <div className="mt-3 grid gap-2">
            {categoryRows.length === 0 ? (
              <EmptyState text="有効な定期支出を登録すると表示されます。" />
            ) : (
              categoryRows.map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between rounded-lg border border-ink/10 bg-paper px-3 py-3">
                  <span className="font-bold">{category}</span>
                  <span className="font-bold text-ink">{formatYen(amount)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">登録済みの定期支出</h3>
          <span className="text-sm font-bold text-ink/60">{expenses.length}件</span>
        </div>
        <div className="mt-3 grid gap-3">
          {expenses.length === 0 ? (
            <EmptyState text="スマホ代、サブスク、家賃などを登録するとここに表示されます。" />
          ) : (
            expenses
              .map((expense) => ({
                expense,
                dueDate: getNextRecurringPaymentDate(expense),
                overdueDates: expense.reflectedMonthKeys.includes(selectedMonth)
                  ? []
                  : getRecurringOccurrencesForMonth(expense, selectedMonth).filter((date) => daysUntil(date) < 0),
              }))
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map(({ expense, dueDate, overdueDates }) => (
                <article key={expense.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-bold">{expense.name}</h4>
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${
                          expense.status === "active" ? "bg-leaf/10 text-leaf" : "bg-ink/10 text-ink/60"
                        }`}>
                          {recurringExpenseStatusLabels[expense.status]}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm leading-6 text-ink/70 sm:grid-cols-2">
                        <p>金額: {formatYen(expense.amount)}</p>
                        <p>カテゴリ: {expense.category}</p>
                        <p>頻度: {recurringExpenseFrequencyLabels[expense.frequency]}</p>
                        <p>支払日: {formatRecurringPaymentSchedule(expense)}</p>
                        <p>方法: {paymentMethodLabels[expense.paymentMethod]}</p>
                        <p>次回: {formatShortDate(dueDate)} / {formatDaysUntilRecurring(daysUntil(dueDate))}</p>
                      </div>
                      {overdueDates.length > 0 && (
                        <p className="mt-2 rounded-md bg-tomato/10 px-2 py-1 text-sm font-bold text-tomato">
                          {selectedMonth} の支払日が過ぎています: {overdueDates.map(formatShortDate).join("、")}
                        </p>
                      )}
                      {expense.memo && <p className="mt-1 text-sm text-ink/55">{expense.memo}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink/70 hover:text-sea"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStatus(expense.id)}
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink/70"
                      >
                        {expense.status === "active" ? "停止" : "有効化"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(expense.id)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-tomato/25 bg-white px-3 py-2 text-sm font-bold text-tomato"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        削除
                      </button>
                    </div>
                  </div>
                </article>
              ))
          )}
        </div>
      </section>
    </div>
  );
}

function FoodsView({
  form,
  dictionaryForm,
  activeIngredients,
  unclassifiedIngredients,
  userIngredientDictionary,
  onSubmit,
  onChange,
  onDictionarySubmit,
  onDictionaryChange,
  onUpdateStatus,
  onEditIngredient,
  onDeleteIngredient,
  onEditDictionaryItem,
  onDeleteDictionaryItem,
  onCancelDictionaryEdit,
  onUseIngredientAsDictionaryDraft,
  isEditing,
  onCancelEdit,
  isDictionaryEditing,
}: {
  form: IngredientFormState;
  dictionaryForm: IngredientDictionaryFormState;
  activeIngredients: Ingredient[];
  unclassifiedIngredients: Ingredient[];
  userIngredientDictionary: IngredientDictionaryItem[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: IngredientFormState | ((current: IngredientFormState) => IngredientFormState)) => void;
  onDictionarySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDictionaryChange: (
    value:
      | IngredientDictionaryFormState
      | ((current: IngredientDictionaryFormState) => IngredientDictionaryFormState),
  ) => void;
  onUpdateStatus: (id: string, status: IngredientStatus) => void;
  onEditIngredient: (ingredient: Ingredient) => void;
  onDeleteIngredient: (id: string) => void;
  onEditDictionaryItem: (item: IngredientDictionaryItem) => void;
  onDeleteDictionaryItem: (id: string) => void;
  onCancelDictionaryEdit: () => void;
  onUseIngredientAsDictionaryDraft: (ingredient: Ingredient) => void;
  isEditing: boolean;
  onCancelEdit: () => void;
  isDictionaryEditing: boolean;
}) {
  const [foodTab, setFoodTab] = useState<"register" | "list">(isEditing ? "register" : "list");

  useEffect(() => {
    if (isEditing) {
      setFoodTab("register");
    }
  }, [isEditing]);

  function handleIngredientSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit(event);
    if (isEditing) {
      setFoodTab("list");
    }
  }

  function handleCancelEdit() {
    onCancelEdit();
    setFoodTab("list");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading eyebrow="Food stock" title="食材管理" />
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-ink/10 bg-white p-2 shadow-soft sm:w-80">
          <SegmentButton
            selected={foodTab === "register"}
            label="食材登録"
            icon={Plus}
            onClick={() => setFoodTab("register")}
          />
          <SegmentButton
            selected={foodTab === "list"}
            label="食材一覧"
            icon={ClipboardList}
            onClick={() => setFoodTab("list")}
          />
        </div>
      </div>

      {foodTab === "register" && (
        <form onSubmit={handleIngredientSubmit} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-bold">{isEditing ? "食材を編集" : "食材を登録"}</h3>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                名前、数量、金額、期限、保存方法を入力して食材ストックに追加します。
              </p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink/70"
              >
                キャンセル
              </button>
            )}
          </div>

          <FoodStockFields form={form} onChange={onChange} />

          <button
            type="submit"
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
          >
            {isEditing ? <Pencil className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
            {isEditing ? "更新する" : "食材を登録"}
          </button>
        </form>
      )}

      {foodTab === "list" && (
        <>
          <IngredientList
            ingredients={activeIngredients}
            onUpdateStatus={onUpdateStatus}
            onEditIngredient={onEditIngredient}
            onDeleteIngredient={onDeleteIngredient}
          />
          <IngredientDictionarySection
            form={dictionaryForm}
            unclassifiedIngredients={unclassifiedIngredients}
            userIngredientDictionary={userIngredientDictionary}
            onSubmit={onDictionarySubmit}
            onChange={onDictionaryChange}
            onEditDictionaryItem={onEditDictionaryItem}
            onDeleteDictionaryItem={onDeleteDictionaryItem}
            onCancelEdit={onCancelDictionaryEdit}
            onUseIngredientAsDictionaryDraft={onUseIngredientAsDictionaryDraft}
            isEditing={isDictionaryEditing}
          />
        </>
      )}
    </div>
  );
}

function FoodStockFields({
  form,
  onChange,
}: {
  form: IngredientFormState;
  onChange: (value: IngredientFormState | ((current: IngredientFormState) => IngredientFormState)) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label>
        <span className="mb-1 block text-sm font-bold text-ink/70">食材名</span>
        <input
          required
          value={form.name}
          onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
          placeholder="例: 卵"
          className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
        />
      </label>
      <label>
        <span className="mb-1 block text-sm font-bold text-ink/70">金額</span>
        <input
          required
          inputMode="numeric"
          min="0"
          value={form.price}
          onChange={(event) => onChange((current) => ({ ...current, price: event.target.value }))}
          type="number"
          placeholder="例: 250"
          className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
        />
      </label>
      <label>
        <span className="mb-1 block text-sm font-bold text-ink/70">購入日</span>
        <input
          required
          value={form.purchaseDate}
          onChange={(event) => onChange((current) => ({ ...current, purchaseDate: event.target.value }))}
          type="date"
          className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
        />
      </label>
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">数量</span>
          <input
            required
            value={form.quantity}
            onChange={(event) => onChange((current) => ({ ...current, quantity: event.target.value }))}
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">単位</span>
          <select
            value={form.unit}
            onChange={(event) => onChange((current) => ({ ...current, unit: event.target.value as IngredientUnit }))}
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          >
            {ingredientUnitOptions.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span className="mb-1 block text-sm font-bold text-ink/70">期限の種類</span>
        <select
          value={form.expiryType}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              expiryType: event.target.value as ExpiryType,
              expiryDate: event.target.value === "none" ? "" : current.expiryDate || toIsoDate(addDays(new Date(), 3)),
            }))
          }
          className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
        >
          {expiryTypes.map((type) => (
            <option key={type} value={type}>
              {expiryTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>
      {form.expiryType !== "none" && (
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">賞味期限・消費期限</span>
          <input
            required
            value={form.expiryDate}
            onChange={(event) => onChange((current) => ({ ...current, expiryDate: event.target.value }))}
            type="date"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
      )}
      <label>
        <span className="mb-1 block text-sm font-bold text-ink/70">保存方法</span>
        <select
          value={form.storageLocation}
          onChange={(event) =>
            onChange((current) => ({ ...current, storageLocation: event.target.value as StorageLocation }))
          }
          className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
        >
          {storageLocations.map((location) => (
            <option key={location} value={location}>
              {storageLocationLabels[location]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-sm font-bold text-ink/70">開封状態</span>
        <select
          value={form.openedStatus}
          onChange={(event) =>
            onChange((current) => ({ ...current, openedStatus: event.target.value as OpenedStatus }))
          }
          className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
        >
          {openedStatuses.map((status) => (
            <option key={status} value={status}>
              {openedStatusLabels[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-sm font-bold text-ink/70">メモ</span>
        <textarea
          value={form.memo}
          onChange={(event) => onChange((current) => ({ ...current, memo: event.target.value }))}
          rows={3}
          placeholder="例: 開封後は早めに使う"
          className="min-h-24 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
        />
      </label>
    </div>
  );
}

function IngredientDictionarySection({
  form,
  unclassifiedIngredients,
  userIngredientDictionary,
  onSubmit,
  onChange,
  onEditDictionaryItem,
  onDeleteDictionaryItem,
  onCancelEdit,
  onUseIngredientAsDictionaryDraft,
  isEditing,
}: {
  form: IngredientDictionaryFormState;
  unclassifiedIngredients: Ingredient[];
  userIngredientDictionary: IngredientDictionaryItem[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (
    value:
      | IngredientDictionaryFormState
      | ((current: IngredientDictionaryFormState) => IngredientDictionaryFormState),
  ) => void;
  onEditDictionaryItem: (item: IngredientDictionaryItem) => void;
  onDeleteDictionaryItem: (id: string) => void;
  onCancelEdit: () => void;
  onUseIngredientAsDictionaryDraft: (ingredient: Ingredient) => void;
  isEditing: boolean;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">食材辞書に追加・編集</h3>
          <p className="mt-1 text-sm leading-6 text-ink/65">
            初期辞書 {initialIngredientDictionary.length}件に、よく使う表記ゆれや相性を追加できます。
          </p>
        </div>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink/70"
          >
            編集をやめる
          </button>
        )}
      </div>

      {unclassifiedIngredients.length > 0 && (
        <div className="mt-4 rounded-lg border border-honey/30 bg-honey/10 p-3">
          <p className="text-sm font-bold text-ink">未分類の食材</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unclassifiedIngredients.slice(0, 8).map((ingredient) => (
              <button
                key={ingredient.id}
                type="button"
                onClick={() => onUseIngredientAsDictionaryDraft(ingredient)}
                className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink/70 hover:text-leaf"
              >
                {ingredient.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">表示名</span>
          <input
            required
            value={form.displayName}
            onChange={(event) => onChange((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="例: しょうが"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">カテゴリ</span>
          <input
            value={form.category}
            onChange={(event) => onChange((current) => ({ ...current, category: event.target.value }))}
            placeholder="例: 野菜"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-ink/70">別名・表記ゆれ</span>
          <textarea
            value={form.aliases}
            onChange={(event) => onChange((current) => ({ ...current, aliases: event.target.value }))}
            rows={2}
            placeholder="例: 生姜、ショウガ、ginger"
            className="min-h-20 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">保存場所</span>
          <select
            value={form.storageType}
            onChange={(event) =>
              onChange((current) => ({ ...current, storageType: event.target.value as StorageLocation }))
            }
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          >
            {storageLocations.map((location) => (
              <option key={location} value={location}>
                {storageLocationLabels[location]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">期限目安</span>
          <input
            required
            inputMode="numeric"
            min="0"
            value={form.defaultExpiryDays}
            onChange={(event) =>
              onChange((current) => ({ ...current, defaultExpiryDays: event.target.value }))
            }
            type="number"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">相性の良い食材</span>
          <textarea
            value={form.compatibleIngredients}
            onChange={(event) =>
              onChange((current) => ({ ...current, compatibleIngredients: event.target.value }))
            }
            rows={3}
            placeholder="例: 豚肉、味噌、ねぎ"
            className="min-h-24 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">レシピカテゴリ</span>
          <textarea
            value={form.recipeCategories}
            onChange={(event) =>
              onChange((current) => ({ ...current, recipeCategories: event.target.value }))
            }
            rows={3}
            placeholder="例: 和食、炒め物"
            className="min-h-24 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-ink/70">タグ</span>
          <input
            value={form.tags}
            onChange={(event) => onChange((current) => ({ ...current, tags: event.target.value }))}
            placeholder="例: 節約、簡単、たんぱく質"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
          >
            {isEditing ? <Pencil className="h-5 w-5" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
            {isEditing ? "辞書を更新" : "辞書に追加"}
          </button>
        </div>
      </form>

      <div className="mt-5 border-t border-ink/10 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-bold">ユーザー追加辞書</h4>
          <span className="text-sm font-bold text-ink/60">{userIngredientDictionary.length}件</span>
        </div>
        <div className="mt-3 grid gap-2">
          {userIngredientDictionary.length === 0 ? (
            <EmptyState text="追加した食材辞書はまだありません。" />
          ) : (
            userIngredientDictionary.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-ink/10 bg-paper p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-bold">{item.displayName}</p>
                  <p className="mt-1 truncate text-sm text-ink/60">
                    {item.category} / {item.aliases.slice(0, 4).join("、") || "別名なし"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => onEditDictionaryItem(item)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-bold text-ink/70 hover:text-sea"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDictionaryItem(item.id)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-bold text-ink/55 hover:text-tomato"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    削除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function RecipesView({
  expiringIngredients,
  recipes,
  externalRecipes,
  externalRecipeStatus,
  externalRecipeMessage,
  recipeForm,
  userRecipes,
  cookingForm,
  cookingPreview,
  activeIngredients,
  cookedDishes,
  cookingSummary,
  selectedCookedDishId,
  onAddRecipe,
  onRecipeFormChange,
  onDeleteUserRecipe,
  onCookingSubmit,
  onCookingFormChange,
  onAddCookingItem,
  onUpdateCookingItem,
  onRemoveCookingItem,
  onStartCookingFromRecipe,
  onSelectCookedDish,
  onDeleteCookedDish,
  onChangeTab,
}: {
  expiringIngredients: Ingredient[];
  recipes: ReturnType<typeof buildRecipeSuggestions>;
  externalRecipes: ExternalRecipe[];
  externalRecipeStatus: ExternalRecipeStatus;
  externalRecipeMessage: string;
  recipeForm: RecipeFormState;
  userRecipes: UserRecipe[];
  cookingForm: CookingFormState;
  cookingPreview: ReturnType<typeof calculateCookedDishIngredients>;
  activeIngredients: Ingredient[];
  cookedDishes: CookedDish[];
  cookingSummary: ReturnType<typeof getCookingMonthlySummary>;
  selectedCookedDishId: string | null;
  onAddRecipe: (event: FormEvent<HTMLFormElement>) => void;
  onRecipeFormChange: (value: RecipeFormState | ((current: RecipeFormState) => RecipeFormState)) => void;
  onDeleteUserRecipe: (id: string) => void;
  onCookingSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCookingFormChange: (value: CookingFormState | ((current: CookingFormState) => CookingFormState)) => void;
  onAddCookingItem: (name?: string) => void;
  onUpdateCookingItem: (id: string, values: Partial<CookingFormItemState>) => void;
  onRemoveCookingItem: (id: string) => void;
  onStartCookingFromRecipe: (recipe: { title: string; ingredients: string[]; recipeUrl?: string }) => void;
  onSelectCookedDish: (id: string | null) => void;
  onDeleteCookedDish: (id: string) => void;
  onChangeTab: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading eyebrow="Recipes" title="食材ストックから作る" />
        <button
          type="button"
          onClick={() => onChangeTab("foods")}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 text-sm font-bold text-white shadow-sm sm:w-auto"
        >
          <Plus className="h-5 w-5" aria-hidden />
          食材を追加
        </button>
      </div>

      <ExpiringSection ingredients={expiringIngredients} />
      <RecipeFormSection
        form={recipeForm}
        onSubmit={onAddRecipe}
        onChange={onRecipeFormChange}
      />
      <RegisteredUserRecipesSection
        userRecipes={userRecipes}
        onDeleteRecipe={onDeleteUserRecipe}
        onCookRecipe={(recipe) =>
          onStartCookingFromRecipe({
            title: recipe.name,
            ingredients: [...new Set([...recipe.requiredIngredients, ...recipe.optionalIngredients])],
          })
        }
      />
      <CookingSection
        form={cookingForm}
        preview={cookingPreview}
        activeIngredients={activeIngredients}
        onSubmit={onCookingSubmit}
        onChange={onCookingFormChange}
        onAddItem={onAddCookingItem}
        onUpdateItem={onUpdateCookingItem}
        onRemoveItem={onRemoveCookingItem}
      />
      <CookedDishHistorySection
        cookedDishes={cookedDishes}
        summary={cookingSummary}
        selectedDishId={selectedCookedDishId}
        onSelectDish={onSelectCookedDish}
        onDeleteDish={onDeleteCookedDish}
      />
      <ExternalRecipeSection
        recipes={externalRecipes}
        status={externalRecipeStatus}
        message={externalRecipeMessage}
        onCookRecipe={(recipe) =>
          onStartCookingFromRecipe({
            title: recipe.recipeTitle,
            ingredients: recipe.recipeMaterial,
            recipeUrl: recipe.recipeUrl,
          })
        }
      />
      <RecipeSection
        title="今日のレシピ提案"
        recipes={recipes.today}
        onCookRecipe={(recipe) =>
          onStartCookingFromRecipe({
            title: recipe.title,
            ingredients: [...new Set([...recipe.usedIngredients, ...recipe.missingIngredients])],
          })
        }
        emptyText="食材を登録すると、期限・相性・節約度を見て提案します。"
      />
      <RecipeSection
        title="期限が近い食材を使うレシピ"
        recipes={recipes.expiring}
        onCookRecipe={(recipe) =>
          onStartCookingFromRecipe({
            title: recipe.title,
            ingredients: [...new Set([...recipe.usedIngredients, ...recipe.missingIngredients])],
          })
        }
        emptyText="期限が近い食材を使う候補はまだありません。"
      />
      <RecipeSection
        title="手持ち食材だけで作れるレシピ"
        recipes={recipes.pantryOnly}
        onCookRecipe={(recipe) =>
          onStartCookingFromRecipe({
            title: recipe.title,
            ingredients: [...new Set([...recipe.usedIngredients, ...recipe.missingIngredients])],
          })
        }
        emptyText="手持ち食材だけで作れる候補はまだありません。"
      />
      <RecipeSection
        title="あと1品買えば作れるレシピ"
        recipes={recipes.oneMissing}
        onCookRecipe={(recipe) =>
          onStartCookingFromRecipe({
            title: recipe.title,
            ingredients: [...new Set([...recipe.usedIngredients, ...recipe.missingIngredients])],
          })
        }
        emptyText="あと1品の買い足しで作れる候補はまだありません。"
      />
      <RecipeSection
        title="自分で追加したレシピ"
        recipes={recipes.userRecipes}
        onCookRecipe={(recipe) =>
          onStartCookingFromRecipe({
            title: recipe.title,
            ingredients: [...new Set([...recipe.usedIngredients, ...recipe.missingIngredients])],
          })
        }
        emptyText="追加したレシピが食材ストックに合うとここに表示されます。"
      />
    </div>
  );
}

function ExternalRecipeSection({
  recipes,
  status,
  message,
  onCookRecipe,
}: {
  recipes: ExternalRecipe[];
  status: ExternalRecipeStatus;
  message: string;
  onCookRecipe?: (recipe: ExternalRecipe) => void;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Soup className="h-5 w-5 text-honey" aria-hidden />
        <h3 className="text-lg font-bold">外部レシピ</h3>
      </div>

      <div className="mt-3 grid gap-3">
        {status === "loading" && (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-ink/20 bg-paper px-3 py-4 text-sm font-bold text-ink/60">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            外部レシピを取得中
          </div>
        )}

        {status !== "loading" && message && <EmptyState text={message} />}

        {status !== "loading" && !message && recipes.length === 0 && (
          <EmptyState text="食材を登録すると、楽天レシピから近い候補を探します。" />
        )}

        {status !== "loading" &&
          recipes.map((recipe) => (
            <ExternalRecipeCard key={recipe.recipeId} recipe={recipe} onCookRecipe={onCookRecipe} />
          ))}
      </div>
    </section>
  );
}

function ExternalRecipeCard({
  recipe,
  onCookRecipe,
}: {
  recipe: ExternalRecipe;
  onCookRecipe?: (recipe: ExternalRecipe) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article className="rounded-lg border border-ink/10 bg-paper p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-bold leading-snug">{recipe.recipeTitle}</h4>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-honey">
              {recipe.sourceCategoryName}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink/65">{recipe.reason}</p>
        </div>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-bold text-ink/70"
        >
          {isExpanded ? "閉じる" : "詳細を見る"}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-white md:aspect-auto">
              {recipe.foodImageUrl ? (
                <img
                  src={recipe.foodImageUrl}
                  alt=""
                  className="h-full min-h-40 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full min-h-40 items-center justify-center text-sm font-bold text-ink/45">
                  画像なし
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="grid grid-cols-2 gap-2 text-center">
                <RecipeMetric label="時間" value={recipe.recipeIndication} />
                <RecipeMetric label="費用" value={recipe.recipeCost} />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <RecipeChipGroup
                  label="使えそうな手持ち食材"
                  values={recipe.usedIngredients}
                  emptyText="なし"
                  tone="leaf"
                />
                <RecipeChipGroup
                  label="足りない可能性がある食材"
                  values={recipe.possibleMissingIngredients}
                  emptyText="少なめ"
                  tone={recipe.possibleMissingIngredients.length === 0 ? "leaf" : "tomato"}
                />
              </div>

              {recipe.recipeMaterial.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-ink/55">材料</p>
                  <p className="mt-1 max-w-full break-words text-sm leading-6 text-ink/70">
                    {recipe.recipeMaterial.join("、")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {onCookRecipe && (
              <button
                type="button"
                onClick={() => onCookRecipe(recipe)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-honey px-4 py-2 text-sm font-bold text-ink sm:w-auto"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                料理を作った
              </button>
            )}
            <a
              href={recipe.recipeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white sm:w-auto"
            >
              元レシピを見る
            </a>
          </div>
        </div>
      )}
    </article>
  );
}

function RecipeFormSection({
  form,
  onSubmit,
  onChange,
}: {
  form: RecipeFormState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: RecipeFormState | ((current: RecipeFormState) => RecipeFormState)) => void;
}) {
  const ratingOptions: RecipeRating[] = [1, 2, 3, 4, 5];

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-2">
        <Plus className="h-5 w-5 text-leaf" aria-hidden />
        <h3 className="text-lg font-bold">新しいレシピを追加</h3>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-ink/70">レシピ名</span>
          <input
            required
            value={form.name}
            onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
            placeholder="例: 卵かけご飯"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>

        <label className="min-w-0">
          <span className="mb-1 block text-sm font-bold text-ink/70">必要な食材</span>
          <textarea
            required
            value={form.requiredIngredients}
            onChange={(event) =>
              onChange((current) => ({ ...current, requiredIngredients: event.target.value }))
            }
            rows={3}
            placeholder="例: 卵、 ご飯"
            className="min-h-24 w-full max-w-full resize-none overflow-x-hidden break-words rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>

        <label className="min-w-0">
          <span className="mb-1 block text-sm font-bold text-ink/70">任意の食材</span>
          <textarea
            value={form.optionalIngredients}
            onChange={(event) =>
              onChange((current) => ({ ...current, optionalIngredients: event.target.value }))
            }
            rows={3}
            placeholder="例: ねぎ、チーズ"
            className="min-h-24 w-full max-w-full resize-none overflow-x-hidden break-words rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-ink/70">作り方メモ</span>
          <textarea
            value={form.notes}
            onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
            rows={3}
            placeholder="例: ご飯に卵をのせて、醤油を少し入れる"
            className="min-h-24 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">調理時間</span>
          <input
            required
            inputMode="numeric"
            min="1"
            value={form.cookingTimeMinutes}
            onChange={(event) =>
              onChange((current) => ({ ...current, cookingTimeMinutes: event.target.value }))
            }
            type="number"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">ジャンル</span>
          <input
            value={form.genre}
            onChange={(event) => onChange((current) => ({ ...current, genre: event.target.value }))}
            placeholder="例: 朝食"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">簡単度</span>
          <select
            value={form.easeLevel}
            onChange={(event) => onChange((current) => ({ ...current, easeLevel: event.target.value }))}
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          >
            {ratingOptions.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">節約度</span>
          <select
            value={form.savingLevel}
            onChange={(event) => onChange((current) => ({ ...current, savingLevel: event.target.value }))}
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          >
            {ratingOptions.map((rating) => (
              <option key={rating} value={rating}>
                {rating}
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
          >
            <Plus className="h-5 w-5" aria-hidden />
            レシピを保存
          </button>
        </div>
      </form>
    </section>
  );
}

function RegisteredUserRecipesSection({
  userRecipes,
  onDeleteRecipe,
  onCookRecipe,
}: {
  userRecipes: UserRecipe[];
  onDeleteRecipe: (id: string) => void;
  onCookRecipe: (recipe: UserRecipe) => void;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-sea" aria-hidden />
          <h3 className="text-lg font-bold">登録済みレシピ</h3>
        </div>
        <span className="text-sm font-bold text-ink/60">{userRecipes.length}件</span>
      </div>

      <div className="mt-3 grid gap-3">
        {userRecipes.length === 0 ? (
          <EmptyState text="新しいレシピを追加すると、ここから料理記録を始められます。" />
        ) : (
          userRecipes.map((recipe) => (
            <article key={recipe.id} className="rounded-lg border border-ink/10 bg-paper p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold leading-snug">{recipe.name}</h4>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-sea">
                      {recipe.genre}
                    </span>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-ink/60">
                      {recipe.cookingTimeMinutes}分
                    </span>
                  </div>
                  <p className="mt-1 max-w-full break-words text-sm leading-6 text-ink/60">
                    {recipe.requiredIngredients.join("、")}
                  </p>
                  {recipe.notes && (
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink/70">{recipe.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteRecipe(recipe.id)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-bold text-ink/55 hover:text-tomato"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  削除
                </button>
              </div>
              <button
                type="button"
                onClick={() => onCookRecipe(recipe)}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-honey px-4 py-2 text-sm font-bold text-ink sm:w-auto"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                料理を作った
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function CookingSection({
  form,
  preview,
  activeIngredients,
  onSubmit,
  onChange,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: {
  form: CookingFormState;
  preview: ReturnType<typeof calculateCookedDishIngredients>;
  activeIngredients: Ingredient[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: CookingFormState | ((current: CookingFormState) => CookingFormState)) => void;
  onAddItem: (name?: string) => void;
  onUpdateItem: (id: string, values: Partial<CookingFormItemState>) => void;
  onRemoveItem: (id: string) => void;
}) {
  const servings = Number(form.servings);
  const perServing =
    preview.totalCost !== null && Number.isFinite(servings) && servings > 0
      ? preview.totalCost / servings
      : null;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-leaf" aria-hidden />
            <h3 className="text-lg font-bold">料理を作った記録</h3>
          </div>
          <p className="mt-1 text-sm leading-6 text-ink/65">
            使った食材を登録すると、同じ単位のストックを自動で減らして原価を計算します。
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-ink/70">料理名</span>
            <input
              required
              value={form.name}
              onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
              placeholder="例: 卵チャーハン"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">作った日</span>
            <input
              required
              type="date"
              value={form.cookedDate}
              onChange={(event) =>
                onChange((current) => ({ ...current, cookedDate: event.target.value }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">何人前</span>
            <input
              required
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.1"
              value={form.servings}
              onChange={(event) =>
                onChange((current) => ({ ...current, servings: event.target.value }))
              }
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">参考にしたレシピ</span>
            <input
              value={form.referenceRecipeTitle}
              onChange={(event) =>
                onChange((current) => ({ ...current, referenceRecipeTitle: event.target.value }))
              }
              placeholder="レシピ名やサイト名"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">写真URL・画像メモ</span>
            <input
              value={form.photoUrl}
              onChange={(event) => onChange((current) => ({ ...current, photoUrl: event.target.value }))}
              placeholder="写真URL、保存場所、メモなど"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-ink/70">参考レシピURL</span>
            <input
              value={form.referenceRecipeUrl}
              onChange={(event) =>
                onChange((current) => ({ ...current, referenceRecipeUrl: event.target.value }))
              }
              placeholder="https://..."
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-ink/70">メモ</span>
            <textarea
              value={form.memo}
              onChange={(event) => onChange((current) => ({ ...current, memo: event.target.value }))}
              rows={3}
              placeholder="味付け、次回の改善点、家族の反応など"
              className="min-h-24 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
        </div>

        <div className="rounded-lg border border-ink/10 bg-paper p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="font-bold">使用した食材</h4>
            <button
              type="button"
              onClick={() => onAddItem()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink/70"
            >
              <Plus className="h-4 w-4" aria-hidden />
              食材を追加
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            {form.items.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-lg border border-ink/10 bg-white p-3 md:grid-cols-[1.2fr_1fr_0.8fr_0.9fr_auto]">
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink/55">ストック</span>
                  <select
                    value={item.ingredientId}
                    onChange={(event) => {
                      const selected = activeIngredients.find((ingredient) => ingredient.id === event.target.value);
                      onUpdateItem(item.id, {
                        ingredientId: event.target.value,
                        ingredientName: selected?.name ?? item.ingredientName,
                        unit: selected?.unit ?? item.unit,
                      });
                    }}
                    className="min-h-11 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2"
                  >
                    <option value="">手入力</option>
                    {activeIngredients.map((ingredient) => (
                      <option key={ingredient.id} value={ingredient.id}>
                        {ingredient.name} ({ingredient.quantity}{ingredient.unit})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink/55">食材名</span>
                  <input
                    value={item.ingredientName}
                    onChange={(event) =>
                      onUpdateItem(item.id, { ingredientName: event.target.value, ingredientId: "" })
                    }
                    placeholder="卵"
                    className="min-h-11 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink/55">使用量</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={item.usedQuantity}
                    onChange={(event) => onUpdateItem(item.id, { usedQuantity: event.target.value })}
                    className="min-h-11 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2"
                  />
                </label>
                <label>
                  <span className="mb-1 block text-xs font-bold text-ink/55">単位</span>
                  <select
                    value={item.unit}
                    onChange={(event) =>
                      onUpdateItem(item.id, { unit: event.target.value as IngredientUnit })
                    }
                    className="min-h-11 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2"
                  >
                    {ingredientUnitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="min-h-11 rounded-lg border border-ink/10 bg-paper px-3 text-sm font-bold text-ink/55 hover:text-tomato md:self-end"
                >
                  削除
                </button>
                <label className="md:col-span-5">
                  <span className="mb-1 block text-xs font-bold text-ink/55">食材メモ</span>
                  <input
                    value={item.note}
                    onChange={(event) => onUpdateItem(item.id, { note: event.target.value })}
                    placeholder="半分だけ使った、皮をむいた後の重さなど"
                    className="min-h-11 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <RecipeMetric label="合計原価" value={formatDishCost(preview.totalCost)} />
          <RecipeMetric label="1人前あたり" value={formatDishCost(perServing)} />
        </div>

        {preview.ingredients.length > 0 && (
          <div className="rounded-lg border border-ink/10 bg-white p-3">
            <h4 className="font-bold">登録前の確認</h4>
            <div className="mt-3 grid gap-2">
              {preview.ingredients.map((ingredient) => (
                <div key={ingredient.id} className="rounded-lg border border-ink/10 bg-paper p-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold">
                      {ingredient.ingredientName}: {ingredient.usedQuantity}{ingredient.unit}
                    </p>
                    <p className="font-bold text-ink/70">
                      {ingredient.costAmount !== null ? formatYen(ingredient.costAmount) : costStatusLabel(ingredient.costStatus)}
                    </p>
                  </div>
                  <p className="mt-1 text-ink/60">
                    {ingredient.stockQuantityBefore !== null && ingredient.stockQuantityAfter !== null
                      ? `ストック ${ingredient.stockQuantityBefore}${ingredient.stockUnit} → ${ingredient.stockQuantityAfter}${ingredient.stockUnit}`
                      : "ストックからの自動減算は行いません"}
                  </p>
                  {ingredient.exceedsStock && (
                    <p className="mt-1 font-bold text-tomato">使用量がストック量を超えています</p>
                  )}
                </div>
              ))}
            </div>
            {preview.warnings.length > 0 && (
              <div className="mt-3 rounded-lg border border-honey/30 bg-honey/10 p-3 text-sm font-bold text-ink/75">
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          料理を登録してストックを減らす
        </button>
      </form>
    </section>
  );
}

function CookedDishHistorySection({
  cookedDishes,
  summary,
  selectedDishId,
  onSelectDish,
  onDeleteDish,
}: {
  cookedDishes: CookedDish[];
  summary: ReturnType<typeof getCookingMonthlySummary>;
  selectedDishId: string | null;
  onSelectDish: (id: string | null) => void;
  onDeleteDish: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-sea" aria-hidden />
        <h3 className="text-lg font-bold">作った料理の履歴</h3>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="今月作った料理" value={`${summary.dishCount}品`} icon={Soup} tone="sea" />
        <MetricCard label="今月の自炊原価" value={formatYen(summary.totalCost)} icon={CircleDollarSign} tone="leaf" />
        <MetricCard label="1食平均" value={formatYen(summary.averageCostPerDish)} icon={TrendingDown} tone="tomato" />
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/65">
        外食との差額は、あとで外食基準額を設定できるようにするとより正確に出せます。
      </p>

      <div className="mt-4 grid gap-3">
        {cookedDishes.length === 0 ? (
          <EmptyState text="今月の料理記録はまだありません。" />
        ) : (
          cookedDishes.map((dish) => {
            const isSelected = selectedDishId === dish.id;

            return (
              <article key={dish.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-bold">{dish.name}</p>
                    <p className="mt-1 text-sm text-ink/60">
                      {formatShortDate(dish.cookedDate)} / {dish.ingredients.length}食材
                    </p>
                    {dish.memo && <p className="mt-2 text-sm leading-6 text-ink/70">{dish.memo}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center sm:w-56">
                    <RecipeMetric label="合計原価" value={formatDishCost(dish.totalCost)} />
                    <RecipeMetric label="1人前" value={formatDishCost(dish.costPerServing)} />
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onSelectDish(isSelected ? null : dish.id)}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-ink/70"
                  >
                    {isSelected ? "詳細を閉じる" : "詳細"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDish(dish.id)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-bold text-ink/55 hover:text-tomato"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    削除
                  </button>
                </div>

                {isSelected && (
                  <div className="mt-3 rounded-lg border border-ink/10 bg-white p-3">
                    <div className="grid gap-2">
                      {dish.ingredients.map((ingredient) => (
                        <div key={ingredient.id} className="flex flex-col gap-1 rounded-lg bg-paper p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-bold">
                            {ingredient.ingredientName}: {ingredient.usedQuantity}{ingredient.unit}
                          </p>
                          <p className="text-ink/70">
                            {ingredient.costAmount !== null
                              ? formatYen(ingredient.costAmount)
                              : costStatusLabel(ingredient.costStatus)}
                          </p>
                        </div>
                      ))}
                    </div>
                    {(dish.referenceRecipeTitle || dish.referenceRecipeUrl) && (
                      <p className="mt-3 text-sm leading-6 text-ink/70">
                        参考レシピ:{" "}
                        {dish.referenceRecipeUrl ? (
                          <a href={dish.referenceRecipeUrl} target="_blank" rel="noreferrer" className="font-bold text-sea underline">
                            {dish.referenceRecipeTitle || dish.referenceRecipeUrl}
                          </a>
                        ) : (
                          dish.referenceRecipeTitle
                        )}
                      </p>
                    )}
                    {dish.photoUrl && (
                      <p className="mt-2 text-sm leading-6 text-ink/70">写真URL・画像メモ: {dish.photoUrl}</p>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatDishCost(cost: number | null): string {
  return cost === null ? "計算できません" : formatYen(Math.round(cost));
}

function SettingsView({
  selectedMonth,
  setSelectedMonth,
  summary,
  monthlyTransactions,
  expenseByCategory,
  onEditTransaction,
  onDeleteTransaction,
  onClearAllData,
}: {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  summary: ReturnType<typeof getMonthlySummary>;
  monthlyTransactions: Transaction[];
  expenseByCategory: Record<string, number>;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onClearAllData: () => void;
}) {
  const categoryRows = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Settings" title="設定と月次レポート" />

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <h3 className="text-lg font-bold">保存と移行</h3>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          今はブラウザ内だけに保存しています。Supabaseへ移行するときは、保存処理を
          <span className="font-bold text-ink"> repository </span>
          から差し替える設計です。
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading eyebrow="Monthly report" title="月ごとの収支" />
        <label className="w-full sm:w-44">
          <span className="mb-1 block text-sm font-bold text-ink/70">対象月</span>
          <input
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            type="month"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3 shadow-sm"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="収入" value={formatYen(summary.income)} icon={TrendingUp} tone="leaf" />
        <MetricCard label="支出" value={formatYen(summary.expense)} icon={TrendingDown} tone="tomato" />
        <MetricCard label="残高" value={formatYen(summary.balance)} icon={CircleDollarSign} tone="sea" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <h3 className="text-lg font-bold">支出カテゴリ</h3>
          <div className="mt-4 space-y-3">
            {categoryRows.length === 0 ? (
              <EmptyState text="この月の支出はまだありません。" />
            ) : (
              categoryRows.map(([category, amount]) => (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="font-bold">{category}</span>
                    <span>{formatYen(amount)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-md bg-ink/10">
                    <div
                      className="h-full rounded-md bg-honey"
                      style={{
                        width: `${Math.max(8, (amount / Math.max(summary.expense, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-bold">記録一覧</h3>
            <span className="text-sm font-bold text-ink/60">{summary.transactionCount}件</span>
          </div>
          <TransactionList
            transactions={monthlyTransactions}
            onEditTransaction={onEditTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        </section>
      </div>

      <div className="rounded-lg border border-tomato/20 bg-white p-4 shadow-soft">
        <p className="font-bold">確認用データの削除</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">
          このMVPはブラウザ内にだけ保存します。別のブラウザや端末には自動同期されません。
        </p>
        <button
          type="button"
          onClick={onClearAllData}
          className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-lg border border-tomato/30 px-4 py-3 text-sm font-bold text-tomato"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          すべて削除
        </button>
      </div>
    </div>
  );
}

function SidePanel({
  activeIngredients,
  recipes,
  onChangeTab,
}: {
  activeIngredients: Ingredient[];
  recipes: ReturnType<typeof buildRecipeSuggestions>;
  onChangeTab: (tab: Tab) => void;
}) {
  return (
    <div className="sticky top-20 space-y-4">
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">食材ストック</h2>
          <button
            type="button"
            onClick={() => onChangeTab("foods")}
            className="rounded-lg border border-ink/15 p-2 text-ink/70 hover:bg-paper"
            title="食材を追加"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {activeIngredients.slice(0, 5).map((ingredient) => (
            <SmallIngredientRow key={ingredient.id} ingredient={ingredient} />
          ))}
          {activeIngredients.length === 0 && <EmptyState text="食材はまだありません。" />}
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <h2 className="text-lg font-bold">提案中のレシピ</h2>
        <div className="mt-3 space-y-3">
          {recipes.today.slice(0, 2).map((recipe) => (
            <div key={recipe.id} className="rounded-lg border border-ink/10 bg-paper p-3">
              <p className="font-bold">{recipe.title}</p>
              <p className="mt-1 text-sm text-ink/65">{recipe.usedIngredients.join("、")}</p>
            </div>
          ))}
          {recipes.today.length === 0 && <EmptyState text="食材を登録すると提案が出ます。" />}
        </div>
      </section>
    </div>
  );
}

function ExpiringSection({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-5 w-5 text-honey" aria-hidden />
        <h3 className="text-lg font-bold">期限が近い食材</h3>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ingredients.length === 0 ? (
          <EmptyState text="5日以内に期限が近い食材はありません。" />
        ) : (
          ingredients.slice(0, 6).map((ingredient) => (
            <SmallIngredientRow key={ingredient.id} ingredient={ingredient} />
          ))
        )}
      </div>
    </section>
  );
}

function RecipeSection({
  title,
  recipes,
  emptyText,
  onCookRecipe,
}: {
  title: string;
  recipes: RecipeSuggestion[];
  emptyText: string;
  onCookRecipe?: (recipe: RecipeSuggestion) => void;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Soup className="h-5 w-5 text-sea" aria-hidden />
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <div className="mt-3 grid gap-3">
        {recipes.length === 0 ? (
          <EmptyState text={emptyText} />
        ) : (
          recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onCookRecipe={onCookRecipe} />
          ))
        )}
      </div>
    </section>
  );
}

function RecipeCard({
  recipe,
  onCookRecipe,
}: {
  recipe: RecipeSuggestion;
  onCookRecipe?: (recipe: RecipeSuggestion) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article className="rounded-lg border border-ink/10 bg-paper p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-bold leading-snug">{recipe.title}</h4>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-sea">
              {recipe.genre}
            </span>
            {recipe.source === "user" && (
              <span className="rounded-md bg-leaf/10 px-2 py-1 text-xs font-bold text-leaf">
                追加レシピ
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-6 text-ink/65">{recipe.subtitle}</p>
        </div>
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-ink/10 bg-white px-4 py-2 text-sm font-bold text-ink/70"
        >
          {isExpanded ? "閉じる" : "詳細を見る"}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <RecipeMetric label="簡単度" value={`${recipe.easeLevel}/5`} />
            <RecipeMetric label="節約度" value={`${recipe.savingLevel}/5`} />
            <RecipeMetric label="時間" value={`${recipe.cookingTimeMinutes}分`} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <RecipeChipGroup
              label="使える手持ち食材"
              values={recipe.usedIngredients}
              emptyText="なし"
              tone="leaf"
            />
            <RecipeChipGroup
              label="足りない食材"
              values={recipe.missingIngredients}
              emptyText="なし"
              tone={recipe.missingIngredients.length === 0 ? "leaf" : "tomato"}
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr]">
            <div className="rounded-lg border border-ink/10 bg-white p-3">
              <p className="text-xs font-bold text-ink/55">期限が近い食材</p>
              <p className={`mt-1 text-sm font-bold ${recipe.usesExpiringIngredient ? "text-honey" : "text-ink/60"}`}>
                {recipe.usesExpiringIngredient ? "使っています" : "使っていません"}
              </p>
            </div>
            <div className="rounded-lg border border-ink/10 bg-white p-3">
              <p className="text-xs font-bold text-ink/55">作りやすさ</p>
              <RatingMeter value={recipe.easeLevel} />
            </div>
            <div className="rounded-lg border border-ink/10 bg-white p-3">
              <p className="text-xs font-bold text-ink/55">なぜ提案したか</p>
              <p className="mt-1 text-sm leading-6 text-ink/75">{recipe.reason}</p>
            </div>
          </div>

          {recipe.steps.length > 0 && (
            <ol className="mt-3 space-y-1 text-sm leading-6 text-ink/75">
              {recipe.steps.slice(0, 3).map((step, index) => (
                <li key={`${recipe.id}-${step}`}>
                  <span className="font-bold text-ink">{index + 1}. </span>
                  {step}
                </li>
              ))}
            </ol>
          )}
          {onCookRecipe && (
            <button
              type="button"
              onClick={() => onCookRecipe(recipe)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-honey px-4 py-2 text-sm font-bold text-ink sm:w-auto"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              料理を作った
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function RecipeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white px-2 py-2">
      <p className="text-xs font-bold text-ink/55">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

function RecipeChipGroup({
  label,
  values,
  emptyText,
  tone,
}: {
  label: string;
  values: string[];
  emptyText: string;
  tone: "leaf" | "tomato";
}) {
  const toneClass = tone === "leaf" ? "bg-leaf/10 text-leaf" : "bg-tomato/10 text-tomato";

  return (
    <div className="min-w-0">
      <p className="text-xs font-bold text-ink/55">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.length === 0 ? (
          <span className="max-w-full break-words rounded-md bg-white px-2 py-1 text-xs font-bold text-ink/55">
            {emptyText}
          </span>
        ) : (
          values.map((value) => (
            <span key={value} className={`max-w-full break-words rounded-md px-2 py-1 text-xs font-bold ${toneClass}`}>
              {value}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function RatingMeter({ value }: { value: RecipeRating }) {
  return (
    <div className="mt-2 grid grid-cols-5 gap-1">
      {[1, 2, 3, 4, 5].map((level) => (
        <span
          key={level}
          className={`h-2 rounded-md ${level <= value ? "bg-leaf" : "bg-ink/10"}`}
        />
      ))}
    </div>
  );
}

function RecentTransactions({
  transactions,
  onEditTransaction,
  onDeleteTransaction,
}: {
  transactions: Transaction[];
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-leaf" aria-hidden />
        <h3 className="text-lg font-bold">最近の記録</h3>
      </div>
      <TransactionList
        transactions={transactions}
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
      />
    </section>
  );
}

function IngredientList({
  ingredients,
  onUpdateStatus,
  onEditIngredient,
  onDeleteIngredient,
}: {
  ingredients: Ingredient[];
  onUpdateStatus: (id: string, status: IngredientStatus) => void;
  onEditIngredient: (ingredient: Ingredient) => void;
  onDeleteIngredient: (id: string) => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [storageFilter, setStorageFilter] = useState<"all" | StorageLocation>("all");
  const [expiryFilter, setExpiryFilter] = useState<"all" | "expiring" | "expired" | "none">("all");
  const normalizedSearchText = searchText.trim().toLowerCase();
  const filteredIngredients = ingredients.filter((ingredient) => {
    const expiryInfo = getIngredientExpiryInfo(ingredient);
    const searchableText = [
      ingredient.name,
      ingredient.memo,
      storageLocationLabels[ingredient.storageLocation],
      ingredient.quantity,
      ingredient.unit,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !normalizedSearchText || searchableText.includes(normalizedSearchText);
    const matchesStorage =
      storageFilter === "all" || ingredient.storageLocation === storageFilter;
    const matchesExpiry =
      expiryFilter === "all" ||
      (expiryFilter === "none" && ingredient.expiryType === "none") ||
      (expiryFilter === "expired" && expiryInfo.days !== null && expiryInfo.days < 0) ||
      (expiryFilter === "expiring" &&
        expiryInfo.days !== null &&
        expiryInfo.days >= 0 &&
        expiryInfo.days <= 5);

    return matchesSearch && matchesStorage && matchesExpiry;
  });

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">登録中の食材</h3>
          <p className="mt-1 text-sm text-ink/65">
            検索や絞り込みで、期限が近い食材や保存場所ごとの食材を確認できます。
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-ink/60">
          {filteredIngredients.length} / {ingredients.length}件
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">食材の検索</span>
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="食材名、メモ、保存場所で検索"
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">保存方法</span>
          <select
            value={storageFilter}
            onChange={(event) => setStorageFilter(event.target.value as "all" | StorageLocation)}
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          >
            <option value="all">すべて</option>
            {storageLocations.map((location) => (
              <option key={location} value={location}>
                {storageLocationLabels[location]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-ink/70">期限状態</span>
          <select
            value={expiryFilter}
            onChange={(event) =>
              setExpiryFilter(event.target.value as "all" | "expiring" | "expired" | "none")
            }
            className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
          >
            <option value="all">すべて</option>
            <option value="expiring">期限が近い</option>
            <option value="expired">期限切れ</option>
            <option value="none">期限なし</option>
          </select>
        </label>
      </div>

      <div className="mt-3 space-y-3">
        {ingredients.length === 0 ? (
          <EmptyState text="食材を登録すると期限順で表示されます。" />
        ) : filteredIngredients.length === 0 ? (
          <EmptyState text="条件に合う食材がありません。検索や絞り込みを変更してください。" />
        ) : (
          filteredIngredients.map((ingredient) => {
            const expiryInfo = getIngredientExpiryInfo(ingredient);
            const expiryDateLabel =
              ingredient.expiryType === "none" || !ingredient.expiryDate
                ? "期限なし"
                : `${expiryTypeLabels[ingredient.expiryType]} ${formatShortDate(ingredient.expiryDate)}`;
            return (
              <article key={ingredient.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold">{ingredient.name}</h4>
                      <span className={`rounded-md border px-2 py-1 text-xs font-bold ${expiryInfo.className}`}>
                        {expiryInfo.label}
                      </span>
                      <span className="rounded-md border border-ink/10 bg-white px-2 py-1 text-xs font-bold text-ink/60">
                        {openedStatusLabels[ingredient.openedStatus]}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm leading-6 text-ink/70 sm:grid-cols-2">
                      <p>
                        数量: {ingredient.quantity}
                        {ingredient.unit}
                      </p>
                      <p>保存: {storageLocationLabels[ingredient.storageLocation]}</p>
                      <p>{expiryDateLabel}</p>
                      <p>{expiryInfo.detail}</p>
                      {ingredient.price > 0 && <p>金額: {formatYen(ingredient.price)}</p>}
                    </div>
                    {ingredient.memo && (
                      <p className="mt-1 text-sm text-ink/55">{ingredient.memo}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <button
                      type="button"
                      onClick={() => onEditIngredient(ingredient)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink/70 hover:text-sea"
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteIngredient(ingredient.id)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-tomato/25 bg-white px-3 py-2 text-sm font-bold text-tomato"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      削除
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(ingredient.id, "used")}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-leaf/25 bg-white px-3 py-2 text-sm font-bold text-leaf"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      使用済み
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(ingredient.id, "discarded")}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-tomato/25 bg-white px-3 py-2 text-sm font-bold text-tomato"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      廃棄
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function TransactionList({
  transactions,
  onEditTransaction,
  onDeleteTransaction,
}: {
  transactions: Transaction[];
  onEditTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (id: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      {transactions.length === 0 ? (
        <EmptyState text="記録はまだありません。" />
      ) : (
        transactions.map((transaction) => (
          <article
            key={transaction.id}
            className="flex flex-col gap-3 rounded-lg border border-ink/10 bg-paper px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                    transaction.type === "income"
                      ? "bg-leaf/10 text-leaf"
                      : "bg-tomato/10 text-tomato"
                  }`}
                >
                  {transaction.type === "income" ? "収入" : "支出"}
                </span>
                <span className="font-bold">{transaction.category}</span>
              </div>
              <p className="mt-1 truncate text-sm text-ink/60">
                {formatShortDate(transaction.date)} / {paymentMethodLabels[transaction.paymentMethod]}
                {transaction.memo ? ` / ${transaction.memo}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <p
                className={`text-right font-bold ${
                  transaction.type === "income" ? "text-leaf" : "text-tomato"
                }`}
              >
                {transaction.type === "income" ? "+" : "-"}
                {formatYen(transaction.amount)}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                {onEditTransaction && (
                  <button
                    type="button"
                    onClick={() => onEditTransaction(transaction)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-bold text-ink/70 hover:text-sea"
                    title="記録を編集"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                    編集
                  </button>
                )}
                {onDeleteTransaction && (
                  <button
                    type="button"
                    onClick={() => onDeleteTransaction(transaction.id)}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm font-bold text-ink/55 hover:text-tomato"
                    title="記録を削除"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    削除
                  </button>
                )}
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function SmallIngredientRow({ ingredient }: { ingredient: Ingredient }) {
  const tone = getExpiryTone(ingredient.expiryDate, ingredient.expiryType);
  const expiryText =
    ingredient.expiryType === "none" || !ingredient.expiryDate
      ? "期限なし"
      : formatShortDate(ingredient.expiryDate);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-paper px-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-bold">{ingredient.name}</p>
        <p className="text-sm text-ink/60">
          {ingredient.quantity}
          {ingredient.unit} / {expiryText}
        </p>
      </div>
      <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-bold ${tone.className}`}>
        {tone.label}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "leaf" | "tomato" | "sea";
}) {
  const toneClass = {
    leaf: "bg-leaf/10 text-leaf",
    tomato: "bg-tomato/10 text-tomato",
    sea: "bg-sea/10 text-sea",
  }[tone];

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${toneClass}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-bold text-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-bold sm:text-[1.7rem]">{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-20 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-white px-4 py-4 text-sm font-bold shadow-soft hover:border-leaf/30 hover:text-leaf sm:text-base"
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

function SegmentButton({
  selected,
  label,
  icon: Icon,
  onClick,
}: {
  selected: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-3 font-bold ${
        selected
          ? "border-leaf bg-leaf text-white"
          : "border-ink/15 bg-paper text-ink/70"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

function PageHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-leaf">{eyebrow}</p>
      <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{title}</h2>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ink/20 bg-paper px-3 py-4 text-sm text-ink/60">
      {text}
    </div>
  );
}

function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}) {
  const items: Array<{ tab: Tab; label: string; icon: LucideIcon }> = [
    { tab: "home", label: "ホーム", icon: Home },
    { tab: "record", label: "記録", icon: ReceiptText },
    { tab: "recurring", label: "固定費", icon: CalendarClock },
    { tab: "foods", label: "食材", icon: Sprout },
    { tab: "recipes", label: "レシピ", icon: Soup },
    { tab: "settings", label: "設定", icon: Settings2 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[2147483647] border-t border-ink/10 bg-white/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pl-14 pr-2 pt-2 shadow-[0_-12px_35px_rgba(32,32,29,0.1)] backdrop-blur min-[430px]:px-2 lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
        {items.map((item) => (
          <button
            key={item.tab}
            type="button"
            onClick={() => onChange(item.tab)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold leading-tight ${
              activeTab === item.tab
                ? "bg-leaf text-white"
                : "text-ink/60 hover:bg-paper hover:text-ink"
            }`}
          >
            <item.icon className="h-5 w-5" aria-hidden />
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function DesktopNav({
  activeTab,
  onChange,
}: {
  activeTab: Tab;
  onChange: (tab: Tab) => void;
}) {
  const items: Array<{ tab: Tab; label: string; icon: LucideIcon }> = [
    { tab: "home", label: "ホーム", icon: Home },
    { tab: "record", label: "記録", icon: ReceiptText },
    { tab: "recurring", label: "固定費", icon: CalendarClock },
    { tab: "foods", label: "食材", icon: Sprout },
    { tab: "recipes", label: "レシピ", icon: Soup },
    { tab: "settings", label: "設定", icon: Settings2 },
  ];

  return (
    <nav className="hidden items-center gap-1 rounded-lg border border-ink/10 bg-white p-1 shadow-sm lg:flex">
      {items.map((item) => (
        <button
          key={item.tab}
          type="button"
          onClick={() => onChange(item.tab)}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
            activeTab === item.tab
              ? "bg-leaf text-white"
              : "text-ink/60 hover:bg-paper hover:text-ink"
          }`}
        >
          <item.icon className="h-4 w-4" aria-hidden />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
