/** Complete Gregorian calendar date only. No age, timezone or current-date calculation. */
export function isCompleteCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** FDA display of a supplied complete date; never fills missing components. */
export function formatCompleteCalendarDate(value: string): string {
  if (!isCompleteCalendarDate(value)) throw new Error(`Unsupported Form 3500 calendar date ${value}`);
  const [year, month, day] = value.split("-");
  return `${day}-${["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Number(month) - 1]}-${year}`;
}
