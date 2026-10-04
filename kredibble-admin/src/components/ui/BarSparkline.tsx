/**
 * BarSparkline: the KPI card's mini chart. Exactly 12 vertical bars, each 4px
 * wide with a 3px gap, in the pale chart colour with ONE bar in orange (the
 * latest by default).
 *
 * Props:
 * - values: numbers in time order. The last 12 are drawn. Fewer than 2 values
 *   draws nothing (a series that short is not a trend). Between 2 and 11 values
 *   are padded on the left with empty stub bars so the shape is always 12 wide.
 * - highlightIndex: which of the 12 bars is orange (default: the last one)
 * - className: size/position from outside (default height h-10)
 * Decorative (aria-hidden): the KPI value next to it carries the meaning, and
 * the pale bars are never the only way to read a number.
 */
import { cn } from "@/lib/cn";

interface BarSparklineProps {
  values: number[];
  highlightIndex?: number;
  className?: string;
}

const BAR_COUNT = 12;

export function BarSparkline({ values, highlightIndex, className }: BarSparklineProps) {
  if (values.length < 2) return null;

  const recent = values.slice(-BAR_COUNT);
  // Missing history is shown as an empty stub (null), never as an invented value.
  const bars: (number | null)[] = [...Array<null>(BAR_COUNT - recent.length).fill(null), ...recent];
  const highlight = highlightIndex ?? BAR_COUNT - 1;
  const max = Math.max(...recent, 1);

  return (
    <div aria-hidden="true" className={cn("flex h-10 items-end gap-0.75", className)}>
      {bars.map((value, index) => (
        <span
          key={index}
          className={cn("w-1 shrink-0 rounded-pill", index === highlight ? "bg-orange-500" : "bg-chart-pale")}
          // Data-driven height (never below 12% so a zero or missing value still shows a stub).
          style={{ height: `${value === null ? 12 : Math.max(12, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
