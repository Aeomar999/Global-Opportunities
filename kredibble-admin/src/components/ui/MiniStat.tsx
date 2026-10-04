/**
 * MiniStat: one number with a label, in a surface-2 tile. Used for counts on
 * detail pages (Applications submitted, Saved opportunities, Applicants, ...).
 * Value: Jakarta 800, 24/30, tabular numerals. Label: Inter 12/16 muted.
 *
 * Props:
 * - value: the count (numbers are formatted with thousands separators)
 * - label: what is counted
 */
interface MiniStatProps {
  value: number | string;
  label: string;
}

export function MiniStat({ value, label }: MiniStatProps) {
  return (
    <div className="rounded-control bg-surface-2 p-4">
      <p className="ministat-value">{typeof value === "number" ? value.toLocaleString("en-US") : value}</p>
      <p className="caption mt-1">{label}</p>
    </div>
  );
}
