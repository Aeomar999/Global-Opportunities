/**
 * Date maths for the DatePicker (src/components/ui/form/DatePicker.tsx). Pure and timezone-free: a date is an ISO string
 * "YYYY-MM-DD", and every calculation goes through UTC, so a local clock or a daylight-saving change can never move a day.
 *
 * - parseTyped(text): what a person may type: "2026-10-07", "7 Oct 2026", "07 October 2026" (case does not matter, extra spaces are
 *   fine). Anything else, and any date that does not exist (31 Feb), is null.
 * - isoToParts / partsToIso, addDays, addMonths (the day is clamped: 31 Jan + 1 month = 28 Feb), startOfWeek (Monday), endOfWeek.
 * - monthGrid(year, month): the 42 days (6 weeks, Monday first) that fill the calendar for that month, with the days of the
 *   neighbouring months that complete the first and last weeks.
 * - disabledReason(date, min, max): why a day cannot be chosen, or null.
 */
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
export const MONTH_ABBR = MONTH_NAMES.map((name) => name.slice(0, 3));
/** Monday first. */
export const WEEKDAYS = [
  { short: "Mo", long: "Monday" },
  { short: "Tu", long: "Tuesday" },
  { short: "We", long: "Wednesday" },
  { short: "Th", long: "Thursday" },
  { short: "Fr", long: "Friday" },
  { short: "Sa", long: "Saturday" },
  { short: "Su", long: "Sunday" },
] as const;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isoToParts(iso: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls 31 Feb over to March: a date that does not exist is not a date.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export const partsToIso = (year: number, month: number, day: number): string => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

const fromDate = (date: Date): string => partsToIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
const toDate = (iso: string): Date => {
  const parts = isoToParts(iso)!;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
};

export const isValidIso = (iso: string): boolean => isoToParts(iso) !== null;

export function addDays(iso: string, days: number): string {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDate(date);
}

/** Adds months and keeps the day when it exists, otherwise the last day of the month (31 Jan + 1 month = 28 Feb). */
export function addMonths(iso: string, months: number): string {
  const { year, month, day } = isoToParts(iso)!;
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return partsToIso(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(day, last));
}

/** 0 = Monday ... 6 = Sunday. */
export const weekdayIndex = (iso: string): number => (toDate(iso).getUTCDay() + 6) % 7;
export const startOfWeek = (iso: string): string => addDays(iso, -weekdayIndex(iso));
export const endOfWeek = (iso: string): string => addDays(iso, 6 - weekdayIndex(iso));

/** The 42 days that fill the calendar of a month (month is 1 to 12), Monday first. */
export function monthGrid(year: number, month: number): string[] {
  const first = partsToIso(year, month, 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** "7 October 2026": the long form, for accessible names. */
export function longDate(iso: string): string {
  const parts = isoToParts(iso);
  return parts ? `${parts.day} ${MONTH_NAMES[parts.month - 1]} ${parts.year}` : iso;
}

/** "7 Oct 2026": the shared short format (the same as formatDate in lib/format.ts). */
export function shortDate(iso: string): string {
  const parts = isoToParts(iso);
  return parts ? `${parts.day} ${MONTH_ABBR[parts.month - 1]} ${parts.year}` : iso;
}

/** What a person may type into the field. Returns the ISO date, or null when the text is not a real date. */
export function parseTyped(text: string): string | null {
  const value = text.trim().replace(/\s+/g, " ");
  if (!value) return null;
  if (ISO_DATE.test(value)) return isoToParts(value) ? value : null;
  const match = /^(\d{1,2}) ([A-Za-z]+),? (\d{4})$/.exec(value);
  if (!match) return null;
  const name = match[2].toLowerCase();
  const index = MONTH_NAMES.findIndex((full) => full.toLowerCase() === name || full.slice(0, 3).toLowerCase() === name || (name === "sept" && full === "September"));
  if (index < 0) return null;
  const iso = partsToIso(Number(match[3]), index + 1, Number(match[1]));
  return isoToParts(iso) ? iso : null;
}

export type DisabledReason = "before the earliest date you can choose" | "after the latest date you can choose";

/** Why a day cannot be chosen (outside min or max), or null when it can. */
export function disabledReason(iso: string, min?: string, max?: string): DisabledReason | null {
  if (min && iso < min) return "before the earliest date you can choose";
  if (max && iso > max) return "after the latest date you can choose";
  return null;
}

/** Keeps a date inside min and max. */
export function clampDate(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

// ---- time of day and date-time (the DateTimeField) -----------------------------------------------------------------------

/** "HH:mm" (24 hour, zero padded). */
export const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * What a person may type as a time (case does not matter, spaces are fine): "6:00 PM", "6pm", "6 pm", "6:30pm", "18:00", "18:45", "06:05".
 * A number alone ("6") is not a time: it needs minutes or am/pm. Returns "HH:mm" (24 hour), or null for anything else
 * ("25:00", "13pm", "6:60", "abc", "").
 */
export function parseTime(text: string): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/i.exec(text.trim().replace(/\s+/g, " "));
  if (!match) return null;
  const hasMinutes = match[2] !== undefined;
  const meridiem = match[3]?.toLowerCase().replace(/\./g, "");
  if (!hasMinutes && !meridiem) return null;
  let hours = Number(match[1]);
  const minutes = hasMinutes ? Number(match[2]) : 0;
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === "pm" ? 12 : 0);
  } else if (hours > 23) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "18:00" -> "6:00 PM", "00:30" -> "12:30 AM" (the 12-hour display). Anything else comes back unchanged. */
export function formatTime12(time: string): string {
  const match = TIME_24H.exec(time);
  if (!match) return time;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? "AM" : "PM"}`;
}

/** The slots of the dropdown: every 30 minutes, 12:00 AM to 11:30 PM (48 of them). */
export const TIME_SLOTS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const value = `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`;
  return { value, label: formatTime12(value) };
});

/** The slot at or just before a time ("18:45" -> "18:30"), used to scroll the list to the current value. */
export const slotFor = (time: string): string => (TIME_24H.test(time) ? `${time.slice(0, 2)}:${Number(time.slice(3)) >= 30 ? "30" : "00"}` : "09:00");

/** "2026-08-02T18:00" (also with seconds, a zone or a space) -> { date: "2026-08-02", time: "18:00" }; a date alone has no time; anything else is empty. */
export function splitDateTime(value: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(value ?? "");
  if (!match || !isoToParts(match[1])) return { date: "", time: "" };
  return { date: match[1], time: match[2] && TIME_24H.test(match[2]) ? match[2] : "" };
}

/** One date-time value from its two parts: "2026-08-02T18:00". An empty date or an empty time gives an empty value. */
export const joinDateTime = (date: string, time: string): string => (isoToParts(date) && TIME_24H.test(time) ? `${date}T${time}` : "");
