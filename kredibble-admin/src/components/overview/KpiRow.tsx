/**
 * KpiRow: the four headline cards. Each card is one link to its queue.
 * Icon tiles alternate brand (orange) / accent (purple).
 *
 * Props:
 * - data: the kpis from getOverview(), or null when they could not be loaded
 *   (every card then shows "—", never 0)
 * - loading: show four skeleton cards with the same size
 */
import { Building2, Clock, Flag, Users } from "lucide-react";
import type { KpiKey, KpiValue } from "@/lib/services/overview";
import { KpiCard, KpiCardSkeleton } from "@/components/ui/KpiCard";

const KPIS = [
  { key: "pendingVerifications", label: "Pending verification", href: "/verification", icon: Clock, tone: "brand" },
  { key: "activeSeekers", label: "Active seekers", href: "/seekers", icon: Users, tone: "accent" },
  { key: "activeHirers", label: "Active hirers", href: "/hirers", icon: Building2, tone: "brand" },
  { key: "openReports", label: "Open reports", href: "/reports", icon: Flag, tone: "accent" },
] as const;

interface KpiRowProps {
  data: Record<KpiKey, KpiValue> | null;
  loading: boolean;
}

export function KpiRow({ data, loading }: KpiRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading || undefined}>
      {KPIS.map(({ key, label, href, icon, tone }) =>
        loading ? (
          <KpiCardSkeleton key={key} />
        ) : (
          <KpiCard
            key={key}
            href={href}
            label={label}
            icon={icon}
            tone={tone}
            value={data?.[key].value ?? null}
            // Only present when the data source provides them (mock mode); never invented.
            delta={data?.[key].delta}
            trend={data?.[key].series}
          />
        ),
      )}
    </div>
  );
}
