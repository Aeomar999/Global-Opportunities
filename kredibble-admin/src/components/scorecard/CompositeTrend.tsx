/**
 * CompositeTrend: the composite score of the last six months as highlight bars (the newest bar orange, a value on every bar, a hidden data
 * table as the text alternative). Each month was scored with the targets and thresholds that applied in it.
 *
 * Props:
 * - series: the six points from compositeSeries() (a month with no composite is left out, never drawn as 0)
 */
import { HighlightBarChart } from "@/components/ui/HighlightBarChart";
import type { CompositePoint } from "@/lib/scorecard";

export function CompositeTrend({ series }: { series: CompositePoint[] }) {
  const data = series.filter((point) => point.score !== null).map((point) => ({ label: point.label, tooltipLabel: point.tooltipLabel, value: point.score! }));
  if (data.length < 2) return <p className="body-sm text-muted">Not enough months to show a trend yet.</p>;
  return <HighlightBarChart data={data} ariaLabel="Composite score, last six months" unit="out of 100" axisMax={100} />;
}
