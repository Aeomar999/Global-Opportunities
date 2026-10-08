/**
 * MiniStat: one number with a label, in a surface-2 tile. Used for counts on
 * detail pages (Applications submitted, Saved opportunities, Applicants, ...).
 * Value: Jakarta 800, 24/30, tabular numerals. Label: Inter 12/16 muted.
 *
 * Props:
 * - value: the count (numbers are formatted with thousands separators)
 * - label: what is counted
 * - caption?: one muted line under the label that explains the number ("Prospect to MOU")
 * - compact?: a flat tile for tight spaces: the number on the left, the label and the caption on its right
 */
interface MiniStatProps {
  value: number | string;
  label: string;
  caption?: string;
  compact?: boolean;
}

export function MiniStat({ value, label, caption, compact = false }: MiniStatProps) {
  const figure = typeof value === "number" ? value.toLocaleString("en-US") : value;
  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-control bg-surface-2 px-3 py-2">
        <p className="ministat-value">{figure}</p>
        <div className="min-w-0">
          <p className="caption text-ink">{label}</p>
          {caption && <p className="caption">{caption}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-control bg-surface-2 p-4">
      <p className="ministat-value">{typeof value === "number" ? value.toLocaleString("en-US") : value}</p>
      <p className="caption mt-1">{label}</p>
      {caption && <p className="caption text-muted">{caption}</p>}
    </div>
  );
}
