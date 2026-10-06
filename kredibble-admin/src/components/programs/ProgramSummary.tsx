"use client";

/**
 * ProgramSummary: the two numbers every program summary shows, as TWO SEPARATE MiniStats:
 *   Active     planned + running (still to happen or happening now)
 *   Delivered  finished and counted toward the monthly target
 * Cancelled programs are in neither. Use this wherever programs are summarised so the pair never drifts; the counts
 * come from programSummary() in services/programs.ts.
 *
 * Props:
 * - programs: the programs to count, or null while they load (both stats then show "—", never 0)
 * - className?: layout classes for the strip
 * Test ids: program-summary, program-summary-active, program-summary-delivered.
 */
import { MiniStat } from "@/components/ui/MiniStat";
import { programSummary } from "@/lib/services/programs";
import type { Program } from "@/lib/mock-entities";

export function ProgramSummary({ programs, className = "" }: { programs: readonly Pick<Program, "status">[] | null; className?: string }) {
  const summary = programs ? programSummary(programs) : null;
  return (
    <section aria-label="Programs summary" data-testid="program-summary" className={`grid grid-cols-2 gap-3 sm:max-w-md ${className}`}>
      <div data-testid="program-summary-active">
        <MiniStat value={summary ? summary.active : "—"} label="Active" />
      </div>
      <div data-testid="program-summary-delivered">
        <MiniStat value={summary ? summary.delivered : "—"} label="Delivered" />
      </div>
    </section>
  );
}
