/**
 * DetailPage: the layout shared by every detail page.
 *
 *   header card (full width)
 *   body grid, 16px gap:
 *     main column (2fr)  content sections as cards ... and the danger zone at the bottom
 *     side column (1fr)  the "Details" card (KeyValueList) and MiniStat cards
 *
 * Below 1024px the grid is ONE column and the side column comes FIRST (the facts before the
 * long content). There is no "Back to ..." link: the breadcrumbs in the top bar do that job.
 *
 * Props:
 * - header: a <DetailHeader />
 * - main: the main-column content (cards)
 * - side: the side-column content (cards)
 * - danger: optional <DangerZone />, rendered at the bottom of the main column
 */
import type { ReactNode } from "react";

interface DetailPageProps {
  header: ReactNode;
  main: ReactNode;
  side: ReactNode;
  danger?: ReactNode;
}

export function DetailPage({ header, main, side, danger }: DetailPageProps) {
  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* DOM order is main then side (the natural reading order); on small screens "order-first" shows the side column first. */}
        <div className="space-y-4 lg:col-span-2">
          {main}
          {danger}
        </div>
        <div className="order-first space-y-4 lg:order-none lg:col-span-1">{side}</div>
      </div>
    </div>
  );
}
