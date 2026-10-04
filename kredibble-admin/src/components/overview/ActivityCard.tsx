/**
 * ActivityCard: "Recent activity" timeline (up to 4 entries).
 * Each entry kind maps to an icon and tint here, so the service only has to
 * say what happened.
 *
 * Full-width card. From 1024px up the entries are split evenly into TWO side-by-side timelines
 * (each still has its 20px gaps and 1px connectors, and no connector hangs below a column's last
 * item); below 1024px it is one timeline.
 *
 * Props:
 * - data: entries, or null when unavailable
 * - loading: show the skeleton with four entries
 */
"use client";

import { Activity, Briefcase, Flag, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { ActivityEntry } from "@/lib/services/overview";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Tone } from "@/components/ui/IconTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMediaQuery } from "@/lib/use-media-query";
import { Timeline } from "@/components/ui/Timeline";
import { UnavailableNote } from "./UnavailableNote";

const KIND_STYLES: Record<ActivityEntry["kind"], { icon: LucideIcon; tone: Tone }> = {
  verification: { icon: ShieldCheck, tone: "accent" },
  opportunity: { icon: Briefcase, tone: "brand" },
  report: { icon: Flag, tone: "warning" },
  user: { icon: Users, tone: "success" },
};

interface ActivityCardProps {
  data: ActivityEntry[] | null;
  loading: boolean;
  className?: string;
}

/** One loading placeholder item: 60px tall (20 title + 4 + 16 + 4 + 16), like a loaded timeline item. */
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

export function ActivityCard({ data, loading, className }: ActivityCardProps) {
  const twoColumns = useMediaQuery("(min-width: 1024px)");
  const columnCount = twoColumns ? 2 : 1;

  // Split entries evenly: with 4 entries each column gets 2.
  const items = (data ?? []).map((entry) => ({
    key: entry.key,
    icon: KIND_STYLES[entry.kind].icon,
    tone: KIND_STYLES[entry.kind].tone,
    title: entry.title,
    description: entry.description,
    time: entry.time,
  }));
  const perColumn = Math.ceil(items.length / columnCount);
  const columns = Array.from({ length: columnCount }, (_, i) => items.slice(i * perColumn, (i + 1) * perColumn));

  return (
    <Card as="section" ariaLabel="Recent activity" className={className}>
      <CardHeader title="Recent activity" subtitle="What happened across the platform lately" />

      {loading ? (
        <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2" aria-busy="true" aria-label="Loading recent activity">
          {Array.from({ length: columnCount }, (_, col) => (
            <div key={col} className="space-y-5">
              {Array.from({ length: 4 / columnCount }, (_, i) => (
                <SkeletonItem key={i} />
              ))}
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="h-75 lg:h-35">
          <UnavailableNote />
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={Activity} title="No recent activity" description="Updates will show up here as they happen." />
      ) : (
        <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
          {columns.map((column, index) => (
            <Timeline key={index} items={column} />
          ))}
        </div>
      )}
    </Card>
  );
}
