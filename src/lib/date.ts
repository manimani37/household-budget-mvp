export function todayIso(): string {
  return toIsoDate(new Date());
}

export function currentMonthKey(): string {
  return todayIso().slice(0, 7);
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntil(dateIso: string): number {
  const now = startOfDay(new Date());
  const target = startOfDay(new Date(`${dateIso}T00:00:00`));
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export function isSameMonth(dateIso: string, monthKey: string): boolean {
  return dateIso.startsWith(monthKey);
}

export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatShortDate(dateIso: string): string {
  const date = new Date(`${dateIso}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
