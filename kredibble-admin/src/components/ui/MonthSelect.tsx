"use client";

/**
 * MonthSelect: the month picker in the Overview and Insights headers (calendar icon + label + chevron).
 * It is the app's own Select (src/components/ui/form/Select.tsx), not a native <select>, so the open list
 * matches the rest of the app: a dropdown panel from 640px up, a bottom sheet ("Select month") on phones.
 *
 * UI only for now: choosing a month does not filter anything (the mock data has no per-month history), so pages
 * that use it say so. `onChange` is optional and receives the label ("October 2026"), for pages that react.
 *
 * Options: the current month and the five before it, newest first, as "October 2026". The current month
 * carries a small muted "Current" label.
 */
import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Select, type SelectOption } from "@/components/ui/form/Select";

const buildMonthOptions = (): SelectOption<string>[] => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      badge: i === 0 ? "Current" : undefined,
    };
  });
};

export function MonthSelect({ onChange }: { onChange?: (label: string) => void }) {
  const options = useMemo(() => buildMonthOptions(), []);
  const [value, setValue] = useState(options[0].value);

  return (
    <Select
      className="w-fit"
      ariaLabel="Month"
      sheetTitle="Select month"
      icon={CalendarDays}
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(options.find((option) => option.value === next)?.label ?? "");
      }}
    />
  );
}
