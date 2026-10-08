"use client";

/**
 * PartnerSummary: the two numbers at the top of the Partners board, as TWO SEPARATE MiniStats (the same pattern as
 * ProgramSummary on the Programs page):
 *   Open pipeline      deals in Prospect, Outreach, Proposal or MOU right now        caption "Prospect to MOU"
 *   Closed this month  partners that moved into Onboard or Renew this calendar month  caption "5 closed in total" (everyone
 *                      now in Onboard or Renew)
 * The counts come from partnerSummary() in services/partners.ts, so this is the one place they are worked out.
 * They count ALL partners, so a filter on the board does not move them. The tiles are compact (the number beside its
 * label and caption), so two of them stacked are barely taller than the health card next to them.
 *
 * Props:
 * - partners: the partners to count, or null while they load (both stats then show "—", never 0)
 * - className?: layout classes for the strip (the Partners page stacks the two tiles in a 240px column from 1280px up)
 * Test ids: partner-summary, partner-summary-open, partner-summary-closed.
 */
import { MiniStat } from "@/components/ui/MiniStat";
import { partnerSummary } from "@/lib/services/partners";
import type { Partner } from "@/lib/mock-entities";

export function PartnerSummary({ partners, className = "" }: { partners: readonly Pick<Partner, "stage" | "stageHistory">[] | null; className?: string }) {
  const summary = partners ? partnerSummary(partners) : null;
  return (
    <section aria-label="Partners summary" data-testid="partner-summary" className={`grid grid-cols-2 gap-2 sm:max-w-md ${className}`}>
      <div data-testid="partner-summary-open">
        <MiniStat value={summary ? summary.open : "—"} label="Open pipeline" caption="Prospect to MOU" compact />
      </div>
      <div data-testid="partner-summary-closed">
        <MiniStat value={summary ? summary.closedThisMonth : "—"} label="Closed this month" caption={summary ? `${summary.closedTotal} closed in total` : undefined} compact />
      </div>
    </section>
  );
}
