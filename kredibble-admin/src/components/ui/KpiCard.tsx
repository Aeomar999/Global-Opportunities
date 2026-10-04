/**
 * KpiCard: one headline number in two layers, per the design brief.
 *
 * - Upper layer (surface-2): label, the big value and a mini bar sparkline
 *   (12 pale bars, the latest one orange).
 * - Footer strip (white): the delta chip, a muted caption and an optional kebab.
 *
 * The WHOLE card is one link (a "stretched link": the label link covers the
 * card, so the kebab can sit above it as a real, separate button). The focus
 * ring is drawn around the whole card.
 *
 * Props:
 * - href: where the card goes (required: every KPI opens its queue)
 * - label: what the number is ("Pending verification")
 * - value: number, or null when unknown. null renders "—" (never 0) with
 *   aria-label "unavailable"
 * - icon / tone: optional IconTile before the label
 * - delta: optional { label, direction, goodDirection, caption }. `goodDirection`
 *   says which way is an improvement, so the chip is green when the change went
 *   that way and amber otherwise. Only pass it when the data source really
 *   provides a comparison; it is never invented for real data.
 * - trend: optional number[] for the bar sparkline. Same rule as delta.
 * - actions: optional MenuItem[]; adds a kebab menu in the footer
 *
 * `KpiCardSkeleton` is the loading placeholder with the same two-layer shape.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { BarSparkline } from "./BarSparkline";
import { DeltaChip } from "./DeltaChip";
import { IconTile, type Tone } from "./IconTile";
import { Kebab } from "./Kebab";
import type { MenuItem } from "./Menu";
import { Skeleton } from "./Skeleton";

interface KpiCardProps {
  href: string;
  label: string;
  value: number | null;
  icon?: LucideIcon;
  tone?: Tone;
  delta?: { label: string; direction: "up" | "down"; goodDirection: "up" | "down"; caption?: string };
  trend?: number[];
  actions?: MenuItem[];
}

export function KpiCard({ href, label, value, icon, tone = "accent", delta, trend, actions }: KpiCardProps) {
  return (
    <div className="card-surface relative flex flex-col overflow-hidden transition-colors duration-150 ease-out hover:border-line-strong">
      {/* Upper layer */}
      <div className="flex flex-1 flex-col justify-between gap-3 bg-surface-2 p-5">
        <div className="flex items-center gap-3">
          {icon && <IconTile icon={icon} tone={tone} size="sm" />}
          <Link
            href={href}
            aria-label={value === null ? `${label}: unavailable` : `${label}: ${value}`}
            // Stretched link: the ::after covers the whole card. The focus ring is moved onto it.
            className={cn(
              "kpi-label rounded-card outline-none after:absolute after:inset-0 after:rounded-card",
              "focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus",
            )}
          >
            {label}
          </Link>
        </div>

        <div className="flex min-h-10 items-end justify-between gap-3">
          <p className="stat-value">
            {value === null ? (
              <span role="img" aria-label="unavailable">
                —
              </span>
            ) : (
              value.toLocaleString("en-US")
            )}
          </p>
          {trend && <BarSparkline values={trend} />}
        </div>
      </div>

      {/* Footer strip */}
      <div className="relative flex h-11 items-center gap-2 border-t border-line bg-surface px-5">
        {delta && (
          <>
            <DeltaChip label={delta.label} direction={delta.direction} goodDirection={delta.goodDirection} />
            {delta.caption && <span className="caption">{delta.caption}</span>}
          </>
        )}
        {actions && (
          // z-10 lifts the kebab above the stretched link so it stays a separate control.
          <span className="relative z-10 ml-auto">
            <Kebab label={`More actions for ${label}`} items={actions} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Same two layers and the same heights as the loaded card, so nothing shifts when data arrives. */
export function KpiCardSkeleton() {
  return (
    <div className="card-surface flex flex-col overflow-hidden" aria-hidden="true">
      <div className="flex flex-1 flex-col justify-between gap-3 bg-surface-2 p-5">
        <div className="flex h-9 items-center gap-3">
          <Skeleton className="size-9 rounded-inset" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="flex h-10 items-end justify-between gap-3">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
      <div className="flex h-11 items-center gap-2 border-t border-line bg-surface px-5">
        <Skeleton className="h-6 w-20 rounded-pill" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
