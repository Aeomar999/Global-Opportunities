/**
 * Date formatting for the whole admin: ONE place, so a date never looks
 * different between the chart, tables, tooltips and activity feed.
 *
 * - formatDate(x)       -> "30 Sep 2026"  (full date: tables, tooltips, feeds)
 * - formatDate(x, "short") -> "Sep 30"    (compact axis labels)
 *
 * Month names are written out here instead of using toLocaleDateString,
 * because some locales abbreviate September as "Sept".
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export type DateStyle = "full" | "short";

/** What a date column says when a record has no date (a real record can lack one): never the text "undefined" or "Invalid Date". */
export const NO_DATE = "Not recorded";

/** Accepts a Date or any string `new Date()` can parse (ISO, "28 Jun 2026", ...). A missing date reads "Not recorded". */
export function formatDate(input: string | Date | null | undefined, style: DateStyle = "full"): string {
  if (input === null || input === undefined || input === "" || input === "undefined") return NO_DATE;
  const date = input instanceof Date ? input : new Date(input);
  // Unparseable values are shown as-is instead of "Invalid Date".
  if (Number.isNaN(date.getTime())) return String(input);

  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  return style === "short" ? `${month} ${day}` : `${day} ${month} ${date.getFullYear()}`;
}

/**
 * Removes emoji from a label so the UI can show the same meaning with an icon plus text instead
 * (for example a channel named "... Jobs 🚨" is shown as "... Jobs" with a flag icon and the word
 * "Flagged"). The stored name is never changed.
 */
export const stripEmoji = (text: string): string =>
  text.replace(/\p{Extended_Pictographic}️?/gu, "").replace(/\s{2,}/g, " ").trim();

/**
 * "3 Oct 2026, 2:05 PM": the ONE format for every date-time in the admin (12-hour clock with AM/PM,
 * month names written out like formatDate). Accepts a Date or any string new Date() can parse.
 */
export function formatDateTime(input: string | Date | null | undefined): string {
  if (input === null || input === undefined || input === "" || input === "undefined") return NO_DATE;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)}, ${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/**
 * Joins items into a sentence list with an Oxford comma:
 * ["a"] -> "a"; ["a", "b"] -> "a and b"; ["a", "b", "c"] -> "a, b, and c".
 */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;

/** "2026-10" -> "October 2026" (month names written out, like formatDate). Unparseable values come back as they are. */
export function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return month;
  return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
}
