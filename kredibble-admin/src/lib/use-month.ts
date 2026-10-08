"use client";

/**
 * useMonth: the month a page is showing, kept in the URL as ?month=YYYY-MM so it survives a reload, can be
 * shared and works with the back button.
 *
 * - month: the selected month ("2026-09"). The default (no parameter) is the current month. A value that is not
 *   a month, is in the future, or is older than the six months of history falls back to the current month.
 * - setMonth(next): changes the parameter (the current month removes it, so the URL stays clean) and keeps any
 *   other parameters, such as ?tab=.
 * - isCurrent: the selected month is the current one.
 * - isReadOnly: the selected month is in the past. A past month is a READ-ONLY SNAPSHOT: screens that edit things
 *   (targets, reports) must not offer edit actions for it.
 * - options: the six selectable months, newest first.
 */
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { currentMonth, monthsBefore } from "@/lib/kpi";
import type { MonthKey } from "@/lib/mock-entities";
import { SERIES_MONTHS } from "@/lib/mock-seed";

const PARAM = "month";
const FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

export function useMonth() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const now = currentMonth();
  const options = useMemo<MonthKey[]>(() => Array.from({ length: SERIES_MONTHS }, (_, i) => monthsBefore(now, i)), [now]);

  const requested = params.get(PARAM);
  const month = requested && FORMAT.test(requested) && options.includes(requested) ? requested : now;

  const setMonth = useCallback(
    (next: MonthKey) => {
      const query = new URLSearchParams(params.toString());
      if (next === now) query.delete(PARAM);
      else query.set(PARAM, next);
      const text = query.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [params, now, pathname, router],
  );

  return { month, setMonth, options, isCurrent: month === now, isReadOnly: month !== now };
}
