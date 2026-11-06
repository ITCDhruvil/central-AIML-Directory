// Pure date helpers for day-notes. Days are "YYYY-MM-DD" strings and all arithmetic is done in UTC, so the server and
// the browser always agree (no timezone drift). Browser-safe: the calendar imports this too.

const pad2 = (n: number) => String(n).padStart(2, "0");

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidMonth(month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(month)) return false;
  const m = Number(month.slice(5));
  return m >= 1 && m <= 12;
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function todayDay(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return todayDay(date);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

/** The Monday of the week that contains `day`. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

/** The key that groups a week's pages: "week:<Monday>". */
export const weekKey = (day: string) => `week:${weekStart(day)}`;

/** True for a day ("YYYY-MM-DD") or a week key ("week:YYYY-MM-DD"). */
export function isValidPageKey(key: string): boolean {
  return isValidDay(key) || (key.startsWith("week:") && isValidDay(key.slice(5)));
}

/** The 7-day window ending on `endDay` (inclusive): { from, to }. */
export function weekEnding(endDay: string, length = 7): { from: string; to: string } {
  return { from: addDays(endDay, -(length - 1)), to: endDay };
}

export type MonthCell = { day: string; inMonth: boolean; weekday: number };

/** Six weeks (42 cells) of a month grid, starting on the Sunday on or before the 1st. */
export function monthCells(month: string): MonthCell[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(Date.UTC(y, m - 1, 1 - first.getUTCDay()));
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
    return { day: todayDay(date), inMonth: date.getUTCMonth() === m - 1, weekday: date.getUTCDay() };
  });
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** e.g. "Wednesday, 5 November 2026" — fixed format, so it never differs between server and browser. */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d} ${MONTHS[m - 1]} ${y}`;
}
