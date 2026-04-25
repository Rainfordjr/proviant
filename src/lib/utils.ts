import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind class merger (standard shadcn/ui utility)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date for display
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

// Format date with time
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

// Generate a batch number (e.g., "BATCH-20260411-001")
export function generateBatchNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0");
  return `BATCH-${dateStr}-${random}`;
}

// Generate an order number
export function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 999)
    .toString()
    .padStart(3, "0");
  return `ORD-${dateStr}-${random}`;
}

// Check if a date is within X days of expiry
export function isNearExpiry(expiryDate: string, daysThreshold: number = 30): boolean {
  const expiry = new Date(expiryDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysThreshold);
  return expiry <= threshold;
}

// Check if expired
export function isExpired(expiryDate: string): boolean {
  return new Date(expiryDate) < new Date();
}

// Truncate text
export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

// ── Calendar helpers ─────────────────────────────────────────────

/** Get the 42-element date array for a month grid (6 rows × 7 cols) */
export function getMonthDates(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay(); // 0 = Sunday
  const dates: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, 1 - startOffset + i);
    dates.push(d);
  }
  return dates;
}

/** Get the 7 dates of the week containing the given date (Sun-Sat) */
export function getWeekDates(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const wd = new Date(d);
    wd.setDate(d.getDate() - day + i);
    dates.push(wd);
  }
  return dates;
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Format a date as YYYY-MM-DD for comparison with scheduled_date */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Short month + day format (e.g. "Apr 25") */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
