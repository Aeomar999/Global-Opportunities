"use client";

/**
 * useReportMonth: the month a Monthly report is showing, kept in the URL as ?month=YYYY-MM (it survives a reload, can be shared and works with the back
 * button). Unlike useMonth the DEFAULT is the last COMPLETE month (a report is written after a month ends); the current month is selectable and is
 * "Month to date".
 *
 * - month: the selected month; a value that is not a month, or is outside the six selectable months, falls back to the default
 * - setMonth(next): changes the parameter (the default removes it, so the URL stays clean) and keeps any other parameter
 * - toDate: the selected month is the current one
 * - options: the six selectable months, newest first
 */
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentMonth, monthsBefore } from "@/lib/kpi";
import type { MonthKey } from "@/lib/mock-entities";
import { SERIES_MONTHS } from "@/lib/mock-seed";
import { lastCompleteMonth } from "@/lib/report";

const FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

export function useReportMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const now = currentMonth();
  const fallback = lastCompleteMonth();
  const options = useMemo<MonthKey[]>(() => Array.from({ length: SERIES_MONTHS }, (_, i) => monthsBefore(now, i)), [now]);
  const requested = params.get("month");
  const month = requested && FORMAT.test(requested) && options.includes(requested) ? requested : fallback;

  const setMonth = useCallback(
    (next: MonthKey) => {
      const query = new URLSearchParams(params.toString());
      if (next === fallback) query.delete("month");
      else query.set("month", next);
      const text = query.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [params, fallback, pathname, router],
  );

  return { month, setMonth, options, toDate: month === now };
}
