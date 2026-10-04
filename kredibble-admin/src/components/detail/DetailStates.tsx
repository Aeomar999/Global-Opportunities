/**
 * Loading, not-found and error states for detail pages.
 *
 * - DetailSkeleton: matches the final shape (a 96px header card, a two-card main column and a side
 *   card), so nothing jumps when the record arrives.
 * - DetailNotFound: an EmptyState inside a card, with a link back to the list.
 * - DetailError: the same layout for a failed load, with a "Try again" button.
 *
 * Props
 * - DetailNotFound: noun ("Seeker"), listLabel ("Seekers Directory"), listHref ("/seekers")
 * - DetailError: message, onRetry
 */
import Link from "next/link";
import { AlertTriangle, SearchX } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

export function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Card className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-inset" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7.5 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-3">
            <Skeleton className="h-5.5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </Card>
          <Card className="space-y-3">
            <Skeleton className="h-5.5 w-32" />
            <Skeleton className="h-14 w-full rounded-control" />
            <Skeleton className="h-14 w-full rounded-control" />
          </Card>
        </div>
        <div className="order-first lg:order-none lg:col-span-1">
          <Card className="space-y-4">
            <Skeleton className="h-5.5 w-24" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="kv-grid">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

export function DetailNotFound({ noun, listLabel, listHref }: { noun: string; listLabel: string; listHref: string }) {
  return (
    <Card as="section" ariaLabel={`${noun} not found`}>
      <EmptyState
        icon={SearchX}
        title={`${noun} not found`}
        description="It may have been removed, or the link is out of date."
        action={
          <Link href={listHref} className={buttonClasses("secondary")}>
            Back to {listLabel}
          </Link>
        }
      />
    </Card>
  );
}

export function DetailError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card as="section" ariaLabel="Could not load">
      <EmptyState
        icon={AlertTriangle}
        tone="danger"
        title="Could not load this record"
        description={message}
        action={
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    </Card>
  );
}
