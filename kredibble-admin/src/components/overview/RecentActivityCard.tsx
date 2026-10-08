"use client";

/**
 * RecentActivityCard: a mixed timeline from the stores, newest first, with 20px between entries (the Timeline's spacing): a new
 * ambassador, a partner moved to a stage, a listing published, a program delivered, a record verified, a testimonial approved.
 *
 * Props:
 * - items: the entries, or null when unavailable
 * - loading: show the skeleton with the same size
 * - notConnected: real-API mode: "Not available yet" (not an error)
 */
import { Activity, GraduationCap, Handshake, Megaphone, MessageSquareQuote, ShieldCheck, UserPlus, type LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Tone } from "@/components/ui/IconTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { Timeline } from "@/components/ui/Timeline";
import type { FeedItem } from "@/lib/services/dashboard-types";
import { NotAvailableYet } from "./NotAvailableYet";
import { UnavailableNote } from "./UnavailableNote";

const KIND_STYLES: Record<FeedItem["kind"], { icon: LucideIcon; tone: Tone }> = {
  ambassador: { icon: UserPlus, tone: "success" },
  partner: { icon: Handshake, tone: "accent" },
  listing: { icon: Megaphone, tone: "brand" },
  program: { icon: GraduationCap, tone: "brand" },
  record: { icon: ShieldCheck, tone: "accent" },
  testimonial: { icon: MessageSquareQuote, tone: "warning" },
};

function SkeletonItem() {
  return (
    <div className="flex gap-3">
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    </div>
  );
}

export function RecentActivityCard({ items, loading, notConnected = false, className }: { items: FeedItem[] | null; loading: boolean; notConnected?: boolean; className?: string }) {
  return (
    <Card as="section" ariaLabel="Recent activity" testId="recent-activity" className={className}>
      <CardHeader title="Recent activity" subtitle="What happened across the desk lately" />
      {loading ? (
        <div className="space-y-5" aria-busy="true" aria-label="Loading recent activity">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
      ) : notConnected ? (
        <NotAvailableYet icon={Activity} />
      ) : !items ? (
        <UnavailableNote message="The activity could not be loaded." />
      ) : items.length === 0 ? (
        <EmptyState icon={Activity} title="No recent activity" description="Updates will show up here as they happen." />
      ) : (
        <Timeline items={items.map((item) => ({ key: item.key, icon: KIND_STYLES[item.kind].icon, tone: KIND_STYLES[item.kind].tone, title: item.title, description: item.description, time: item.time }))} />
      )}
    </Card>
  );
}
