"use client";

/**
 * MonthSelect: the month picker in the page headers (calendar icon + label + chevron). It is the app's own Select
 * (src/components/ui/form/Select.tsx), not a native <select>: a dropdown panel from 640px up, a bottom sheet
 * ("Select month") on phones.
 *
 * It shows and changes the page's month through useMonth (src/lib/use-month.ts), which keeps the choice in the
 * URL as ?month=YYYY-MM. The default is the current month; a past month is a read-only snapshot.
 *
 * Options: the current month and the five before it, newest first, as "October 2026". The current month
 * carries a small muted "Current" label. No props: every page that shows a month uses the same state.
 */
import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { formatMonth } from "@/lib/format";
import { useMonth } from "@/lib/use-month";

export function MonthSelect() {
  const { month, setMonth, options: months } = useMonth();
  const options = useMemo<SelectOption<string>[]>(
    () => months.map((value, index) => ({ value, label: formatMonth(value), badge: index === 0 ? "Current" : undefined })),
    [months],
  );

  return <Select className="w-fit" ariaLabel="Month" sheetTitle="Select month" icon={CalendarDays} options={options} value={month} onChange={setMonth} />;
}
