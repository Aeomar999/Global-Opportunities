"use client";

/**
 * NetworkSummary: the three numbers at the top of the Network page, as compact tiles with a caption (the same pattern as
 * the Partners and Programs summaries):
 *   Network size   everyone in the network, applicants included
 *   Active         ambassadors whose status is Active
 *   Activity rate  active ambassadors who logged at least one share THIS MONTH, divided by the active ones,
 *                  with the two numbers behind it in the caption ("14 of 25 active shared this month")
 * The maths is networkSummary() in services/network.ts. They count ALL ambassadors, so a filter does not move them.
 * With no active ambassador the rate is "—", never a made-up 0%.
 *
 * Props:
 * - ambassadors, logs: what to count, or null while they load (every tile then shows "—")
 * Test ids: network-summary, network-size, network-active, network-rate.
 */
import { MiniStat } from "@/components/ui/MiniStat";
import { networkSummary } from "@/lib/services/network";
import type { AmplificationLog, Ambassador } from "@/lib/mock-entities";

export function NetworkSummary({ ambassadors, logs }: { ambassadors: readonly Pick<Ambassador, "id" | "status">[] | null; logs: readonly Pick<AmplificationLog, "ambassadorId" | "at">[] }) {
  const summary = ambassadors ? networkSummary(ambassadors, logs) : null;
  const rate = summary?.activityRate;
  return (
    <section aria-label="Network summary" data-testid="network-summary" className="grid gap-2 sm:grid-cols-3 sm:max-w-5xl">
      <div data-testid="network-size">
        <MiniStat compact value={summary ? summary.size : "—"} label="Network size" caption={summary ? "All statuses" : undefined} />
      </div>
      <div data-testid="network-active">
        <MiniStat compact value={summary ? summary.active : "—"} label="Active" caption={summary ? `Of ${summary.size} in the network` : undefined} />
      </div>
      <div data-testid="network-rate">
        <MiniStat
          compact
          value={rate === undefined || rate === null ? "—" : `${Math.round(rate * 100)}%`}
          label="Activity rate"
          caption={summary ? (summary.active === 0 ? "no active ambassadors" : `${summary.sharedActive} of ${summary.active} active shared this month`) : undefined}
        />
      </div>
    </section>
  );
}
