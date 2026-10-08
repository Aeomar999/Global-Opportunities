/**
 * Scorecard settings (editable).
 *
 * SCORE_FROM_DAY: the first day of the CURRENT month on which a composite score is worked out. Before it, the first days of a month give a
 * very noisy picture (one missed post on day 2 reads as "far behind a pace of 6%"), so the composite is held back: the ring shows a dash and
 * the message "Too early in the month to score", and the Team ranking waits ("Scores start on day 5"). Nothing else is held back: the
 * Overview cards keep their status chips, and every metric row on the scorecard still shows its own figures.
 *
 * A PAST month is always scored (it is complete). The day is the UTC day of the month, like every date calculation in lib/kpi.ts.
 */
export const SCORE_FROM_DAY = 5;

/** The message that stands in for the composite before SCORE_FROM_DAY. */
export const TOO_EARLY_MESSAGE = "Too early in the month to score";

/** Attainment above this share (3 = 300%) is shown as "300%+", with the exact figure in a Tooltip. The composite caps every metric at 100% anyway. */
export const ATTAINMENT_DISPLAY_CAP = 3;
