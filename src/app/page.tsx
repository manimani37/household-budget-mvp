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
  getExpiryTone,
  getMonthlySummary,
  getMonthlyTransactions,
} from "@/lib/calculations";
import { currentMonthKey, formatShortDate, formatYen, todayIso, toIsoDate } from "@/lib/date";
import {
  createId,
  emptyHouseholdData,
  LocalStorageHouseholdRepository,
} from "@/lib/repository";
import { buildRecipeSuggestions } from "@/lib/recipes";
import type {
  HouseholdData,
  Ingredient,
  IngredientStatus,
  PaymentMethod,
  StorageLocation,
  Transaction,
  TransactionType,
} from "@/types/domain";
import {
  expenseCategories,
  incomeCategories,
  paymentMethodLabels,
  storageLocationLabels,
} from "@/types/domain";

type Tab = "home" | "record" | "foods" | "recipes" | "settings";

type RecordMode = "manual" | "receipt";

type TransactionFormState = {
  type: TransactionType;
  amount: string;
  category: string;
  paymentMethod: PaymentMethod;
  date: string;
  memo: string;
};

type IngredientFormState = {
  name: string;
  quantity: string;
  unit: string;
  purchaseDate: string;
  expiryDate: string;
  storageLocation: StorageLocation;
  memo: string;
};

type ReceiptItemDraft = {
  id: string;
  name: string;
  selected: boolean;
  quantity: string;
  unit: string;
  expiryDate: string;
  storageLocation: StorageLocation;
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
const storageLocations = Object.keys(storageLocationLabels) as StorageLocation[];
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
  };
}

function defaultIngredientForm(): IngredientFormState {
  return {
    name: "",
    quantity: "1",
    unit: "個",
    purchaseDate: todayIso(),
    expiryDate: toIsoDate(addDays(new Date(), 3)),
    storageLocation: "fridge",
    memo: "",
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
    quantity: "1",
    unit: "個",
    expiryDate: toIsoDate(addDays(new Date(`${receiptDate}T00:00:00`), 3)),
    storageLocation: "fridge",
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
  const [ingredientForm, setIngredientForm] =
    useState<IngredientFormState>(defaultIngredientForm);

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
  const activeIngredients = useMemo(
    () => getActiveIngredients(data.ingredients),
    [data.ingredients],
  );
  const expiringIngredients = useMemo(
    () => getExpiringIngredients(data.ingredients, 5),
    [data.ingredients],
  );
  const recipes = useMemo(
    () => buildRecipeSuggestions(data.ingredients),
    [data.ingredients],
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

  const hasAnyData = data.transactions.length > 0 || data.ingredients.length > 0;
  const transactionCategories =
    transactionForm.type === "expense" ? expenseCategories : incomeCategories;

  function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amount = Number(transactionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: createId("txn"),
      type: transactionForm.type,
      amount,
      category: transactionForm.category,
      paymentMethod: transactionForm.paymentMethod,
      date: transactionForm.date,
      memo: transactionForm.memo.trim(),
      createdAt: now,
      updatedAt: now,
    };

    setData((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
    }));
    setTransactionForm((current) => ({
      ...current,
      amount: "",
      memo: "",
      date: todayIso(),
    }));
    setActiveTab("home");
  }

  function addIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ingredientForm.name.trim()) {
      return;
    }

    const now = new Date().toISOString();
    const ingredient: Ingredient = {
      id: createId("food"),
      name: ingredientForm.name.trim(),
      quantity: ingredientForm.quantity.trim() || "1",
      unit: ingredientForm.unit.trim() || "個",
      purchaseDate: ingredientForm.purchaseDate,
      expiryDate: ingredientForm.expiryDate,
      storageLocation: ingredientForm.storageLocation,
      status: "active",
      memo: ingredientForm.memo.trim(),
      createdAt: now,
      updatedAt: now,
    };

    setData((current) => ({
      ...current,
      ingredients: [ingredient, ...current.ingredients],
    }));
    setIngredientForm(defaultIngredientForm());
    setActiveTab("home");
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
      .map((item) => ({
        id: createId("food"),
        name: item.name.trim(),
        quantity: item.quantity.trim() || "1",
        unit: item.unit.trim() || "個",
        purchaseDate: draft.date || todayIso(),
        expiryDate: item.expiryDate || toIsoDate(addDays(new Date(), 3)),
        storageLocation: item.storageLocation,
        status: "active",
        memo: draft.storeName ? `レシートOCR: ${draft.storeName}` : "レシートOCR",
        createdAt: now,
        updatedAt: now,
      }));

    setData((current) => ({
      ...current,
      transactions: [transaction, ...current.transactions],
      ingredients: [...ingredients, ...current.ingredients],
    }));
    setActiveTab("home");
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

  function deleteTransaction(id: string) {
    setData((current) => ({
      ...current,
      transactions: current.transactions.filter((transaction) => transaction.id !== id),
    }));
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
        quantity: "1",
        unit: "丁",
        purchaseDate: todayIso(),
        expiryDate: toIsoDate(addDays(new Date(), 1)),
        storageLocation: "fridge",
        status: "active",
        memo: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId("food"),
        name: "玉ねぎ",
        quantity: "2",
        unit: "個",
        purchaseDate: todayIso(),
        expiryDate: toIsoDate(addDays(new Date(), 4)),
        storageLocation: "pantry",
        status: "active",
        memo: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId("food"),
        name: "卵",
        quantity: "6",
        unit: "個",
        purchaseDate: todayIso(),
        expiryDate: toIsoDate(addDays(new Date(), 5)),
        storageLocation: "fridge",
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
            />
          )}

          {activeTab === "record" && (
            <RecordView
              form={transactionForm}
              categories={transactionCategories}
              onSubmit={addTransaction}
              onChange={setTransactionForm}
              onRegisterReceipt={addReceiptDraft}
            />
          )}

          {activeTab === "foods" && (
            <FoodsView
              form={ingredientForm}
              activeIngredients={activeIngredients}
              onSubmit={addIngredient}
              onChange={setIngredientForm}
              onUpdateStatus={updateIngredientStatus}
            />
          )}

          {activeTab === "recipes" && (
            <RecipesView
              expiringIngredients={expiringIngredients}
              recipes={recipes}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <ActionButton label="支出・収入を追加" icon={ReceiptText} onClick={() => onChangeTab("record")} />
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
      <RecipeSection recipes={recipes} />
      <RecentTransactions transactions={recentTransactions} />
    </div>
  );
}

function RecordView({
  form,
  categories,
  onSubmit,
  onChange,
  onRegisterReceipt,
}: {
  form: TransactionFormState;
  categories: string[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: TransactionFormState | ((current: TransactionFormState) => TransactionFormState)) => void;
  onRegisterReceipt: (draft: ReceiptDraft) => void;
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

        <button
          type="submit"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
        >
          <Plus className="h-5 w-5" aria-hidden />
          登録する
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
          quantity: "1",
          unit: "個",
          expiryDate: toIsoDate(addDays(new Date(current.date || todayIso()), 3)),
          storageLocation: "fridge",
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
                  <span className="grid flex-1 gap-3 sm:grid-cols-[1fr_96px_80px]">
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
                      <input
                        aria-label="単位"
                        value={item.unit}
                        onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      />
                    </span>
                    <span>
                      <span className="mb-1 block text-sm font-bold text-ink/70">期限</span>
                      <input
                        aria-label="期限"
                        value={item.expiryDate}
                        onChange={(event) => updateItem(item.id, { expiryDate: event.target.value })}
                        type="date"
                        className="min-h-12 w-full rounded-lg border border-ink/15 bg-white px-3 py-3"
                      />
                    </span>
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

function FoodsView({
  form,
  activeIngredients,
  onSubmit,
  onChange,
  onUpdateStatus,
}: {
  form: IngredientFormState;
  activeIngredients: Ingredient[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: IngredientFormState | ((current: IngredientFormState) => IngredientFormState)) => void;
  onUpdateStatus: (id: string, status: IngredientStatus) => void;
}) {
  return (
    <div className="space-y-5">
      <PageHeading eyebrow="Food stock" title="食材と期限を登録" />

      <form onSubmit={onSubmit} className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">食材名</span>
            <input
              required
              value={form.name}
              onChange={(event) =>
                onChange((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="例: 豆腐"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <div className="grid grid-cols-[1fr_88px] gap-2">
            <label>
              <span className="mb-1 block text-sm font-bold text-ink/70">数量</span>
              <input
                value={form.quantity}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-bold text-ink/70">単位</span>
              <input
                value={form.unit}
                onChange={(event) =>
                  onChange((current) => ({ ...current, unit: event.target.value }))
                }
                className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
              />
            </label>
          </div>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">購入日</span>
            <input
              value={form.purchaseDate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  purchaseDate: event.target.value,
                }))
              }
              type="date"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">期限</span>
            <input
              required
              value={form.expiryDate}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  expiryDate: event.target.value,
                }))
              }
              type="date"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
          <label>
            <span className="mb-1 block text-sm font-bold text-ink/70">保存場所</span>
            <select
              value={form.storageLocation}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  storageLocation: event.target.value as StorageLocation,
                }))
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
            <span className="mb-1 block text-sm font-bold text-ink/70">メモ</span>
            <input
              value={form.memo}
              onChange={(event) =>
                onChange((current) => ({ ...current, memo: event.target.value }))
              }
              placeholder="例: 半分使用済み"
              className="min-h-12 w-full rounded-lg border border-ink/15 bg-paper px-3 py-3"
            />
          </label>
        </div>

        <button
          type="submit"
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-leaf px-4 py-3 font-bold text-white shadow-sm sm:w-auto"
        >
          <Plus className="h-5 w-5" aria-hidden />
          食材を登録
        </button>
      </form>

      <IngredientList
        ingredients={activeIngredients}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
}

function RecipesView({
  expiringIngredients,
  recipes,
  onChangeTab,
}: {
  expiringIngredients: Ingredient[];
  recipes: ReturnType<typeof buildRecipeSuggestions>;
  onChangeTab: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeading eyebrow="Recipes" title="期限が近い食材から作る" />
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
      <RecipeSection recipes={recipes} />
    </div>
  );
}

function SettingsView({
  selectedMonth,
  setSelectedMonth,
  summary,
  monthlyTransactions,
  expenseByCategory,
  onDeleteTransaction,
  onClearAllData,
}: {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  summary: ReturnType<typeof getMonthlySummary>;
  monthlyTransactions: Transaction[];
  expenseByCategory: Record<string, number>;
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
          {recipes.slice(0, 2).map((recipe) => (
            <div key={recipe.title} className="rounded-lg border border-ink/10 bg-paper p-3">
              <p className="font-bold">{recipe.title}</p>
              <p className="mt-1 text-sm text-ink/65">{recipe.usedIngredients.join("、")}</p>
            </div>
          ))}
          {recipes.length === 0 && <EmptyState text="食材を登録すると提案が出ます。" />}
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

function RecipeSection({ recipes }: { recipes: ReturnType<typeof buildRecipeSuggestions> }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <Soup className="h-5 w-5 text-sea" aria-hidden />
        <h3 className="text-lg font-bold">登録食材からレシピ提案</h3>
      </div>
      <div className="mt-3 grid gap-3">
        {recipes.length === 0 ? (
          <EmptyState text="食材を登録すると、期限が近いものを優先して提案します。" />
        ) : (
          recipes.map((recipe) => (
            <article key={recipe.title} className="rounded-lg border border-ink/10 bg-paper p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="font-bold">{recipe.title}</h4>
                  <p className="mt-1 text-sm text-ink/65">{recipe.subtitle}</p>
                </div>
                <p className="rounded-md bg-white px-2 py-1 text-xs font-bold text-sea">
                  {recipe.usedIngredients.join("、")}
                </p>
              </div>
              <ol className="mt-3 space-y-1 text-sm leading-6 text-ink/75">
                {recipe.steps.map((step, index) => (
                  <li key={step}>
                    <span className="font-bold text-ink">{index + 1}. </span>
                    {step}
                  </li>
                ))}
              </ol>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-leaf" aria-hidden />
        <h3 className="text-lg font-bold">最近の記録</h3>
      </div>
      <TransactionList transactions={transactions} />
    </section>
  );
}

function IngredientList({
  ingredients,
  onUpdateStatus,
}: {
  ingredients: Ingredient[];
  onUpdateStatus: (id: string, status: IngredientStatus) => void;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">登録中の食材</h3>
        <span className="text-sm font-bold text-ink/60">{ingredients.length}件</span>
      </div>
      <div className="mt-3 space-y-3">
        {ingredients.length === 0 ? (
          <EmptyState text="食材を登録すると期限順で表示されます。" />
        ) : (
          ingredients.map((ingredient) => {
            const tone = getExpiryTone(ingredient.expiryDate);
            return (
              <article key={ingredient.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold">{ingredient.name}</h4>
                      <span className={`rounded-md border px-2 py-1 text-xs font-bold ${tone.className}`}>
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink/70">
                      {ingredient.quantity}
                      {ingredient.unit} / {storageLocationLabels[ingredient.storageLocation]} / 期限{" "}
                      {formatShortDate(ingredient.expiryDate)}
                    </p>
                    {ingredient.memo && (
                      <p className="mt-1 text-sm text-ink/55">{ingredient.memo}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
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
  onDeleteTransaction,
}: {
  transactions: Transaction[];
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
            className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-paper px-3 py-3"
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
            <div className="flex shrink-0 items-center gap-2">
              <p
                className={`font-bold ${
                  transaction.type === "income" ? "text-leaf" : "text-tomato"
                }`}
              >
                {transaction.type === "income" ? "+" : "-"}
                {formatYen(transaction.amount)}
              </p>
              {onDeleteTransaction && (
                <button
                  type="button"
                  onClick={() => onDeleteTransaction(transaction.id)}
                  className="rounded-lg border border-ink/10 bg-white p-2 text-ink/55 hover:text-tomato"
                  title="記録を削除"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function SmallIngredientRow({ ingredient }: { ingredient: Ingredient }) {
  const tone = getExpiryTone(ingredient.expiryDate);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-paper px-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-bold">{ingredient.name}</p>
        <p className="text-sm text-ink/60">
          {ingredient.quantity}
          {ingredient.unit} / {formatShortDate(ingredient.expiryDate)}
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
    { tab: "foods", label: "食材", icon: Sprout },
    { tab: "recipes", label: "レシピ", icon: Soup },
    { tab: "settings", label: "設定", icon: Settings2 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[2147483647] border-t border-ink/10 bg-white/95 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pl-14 pr-2 pt-2 shadow-[0_-12px_35px_rgba(32,32,29,0.1)] backdrop-blur min-[430px]:px-2 lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
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
