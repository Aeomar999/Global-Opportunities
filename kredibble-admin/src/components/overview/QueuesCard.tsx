/**
 * QueuesCard: "Review queues": progress rows with purple fill, the percentage
 * right-aligned on the label line and a muted caption under each bar.
 *
 * The card is a flex column that stretches to the height of its row neighbour. The rows spread
 * evenly over the free space (justify-between) and the callout sits at the very bottom, so the
 * card never ends in a large empty area.
 *
 * Props:
 * - note: optional one-line summary shown as a neutral inset callout (target icon, balanced wrap).
 *   Mock mode only: in real mode the figure is unknown, so the callout is not rendered at all.
 * - data: the rows from getOverview(), or null when unavailable. Mock mode has
 *   three rows; real mode only the ones it can compute (verification, opportunities).
 * - loading: show the skeleton with the same rows
 */
import { Target } from "lucide-react";
import type { QueueProgress } from "@/lib/services/overview";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressRow } from "@/components/ui/ProgressRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { UnavailableNote } from "./UnavailableNote";

interface QueuesCardProps {
  data: QueueProgress[] | null;
  note: string | null;
  loading: boolean;
  className?: string;
}

export function QueuesCard({ data, note, loading, className }: QueuesCardProps) {
  return (
    <Card as="section" ariaLabel="Review queues" className={`flex flex-col ${className ?? ""}`}>
      <CardHeader title="Review queues" subtitle="How much of each queue has been decided" />

      {loading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading review queues">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4.5 w-full" />
              <Skeleton className="h-1.5 w-full rounded-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="min-h-54 flex-1">
          <UnavailableNote />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex flex-1 flex-col justify-between gap-6">
            {data.map((row) => (
              <ProgressRow key={row.key} label={row.label} percent={row.percent} caption={row.caption} tone="accent" />
            ))}
          </div>
          {note && (
            <p className="body-sm flex items-center gap-3 rounded-control bg-neutral-soft px-4 py-3 text-ink">
              <Target size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-orange-700" />
              {/* text-balance evens out the line lengths when the note wraps */}
              <span className="text-balance">{note}</span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
