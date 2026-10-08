/**
 * Plural helpers: ONE place for "1 share" / "2 shares" so a count label is never patched string by string.
 *
 * - pluralize(count, singular, plural?)  "1 share", "2 shares", "0 shares" (the number with thousands separators, then the right word). The plural defaults to
 *   the singular plus "s"; pass it for the rest ("person" -> "people").
 * - kpiUnit(key, count)                  a KPI's unit in the right number: "1 program" has "of 1 program", "of 4 programs" ("person reached" / "people reached").
 */
import { KPIS, type KpiKey } from "@/config/kpis";

export const pluralize = (count: number, singular: string, plural: string = `${singular}s`): string => `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;

/** Just the word, in the right number, for a number that is shown separately ("of 21 ambassadors": the 21 is formatted by the caller). */
export const pluralWord = (count: number, singular: string, plural: string = `${singular}s`): string => (count === 1 ? singular : plural);

/** The unit of a KPI for a count: "listing" for 1, "listings" otherwise ("person reached" / "people reached"). */
export const kpiUnit = (key: KpiKey, count: number): string => (count === 1 ? KPIS[key].unitOne : KPIS[key].unit);
