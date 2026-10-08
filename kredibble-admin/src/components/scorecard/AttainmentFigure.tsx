"use client";

/**
 * AttainmentFigure: an attainment percentage as it is SHOWN. Up to 300% it is the whole number ("118%"). Above 300% it reads "300%+" and the
 * EXACT figure ("527%") is in the Tooltip (hover and keyboard focus) and in the aria-label, so a screen reader hears the real number. The
 * exact figure is also kept in `data-exact` for tests. Only the display is capped: the value is not, and the composite counts each metric at
 * 100% at most.
 *
 * Props:
 * - value: the attainment (1.18 = 118%), or null for "—" (never 0%)
 * - className: text styling
 * - testId: a data-testid for the figure
 */
import { Tooltip } from "@/components/ui/Tooltip";
import { formatAttainment } from "@/lib/scorecard";

export function AttainmentFigure({ value, className, testId }: { value: number | null; className?: string; testId?: string }) {
  const figure = formatAttainment(value);
  if (!figure.capped) {
    return (
      <span data-testid={testId} data-exact={figure.exact} className={className}>
        {figure.text}
      </span>
    );
  }
  return (
    <Tooltip label={figure.exact}>
      <span data-testid={testId} data-exact={figure.exact} data-capped="true" tabIndex={0} role="img" aria-label={figure.exact} className={className}>
        {figure.text}
      </span>
    </Tooltip>
  );
}
