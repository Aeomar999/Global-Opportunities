"use client";

/**
 * NeedsAttentionCard: the ONE dark card on the Overview. Up to four frosted rows for the queues waiting on a person, each one a
 * link to its queue: Pending verifications, Open reports, Pending testimonials, Unvetted draft listings.
 *
 * A row is shown only when the viewer may see that queue (can(screen, "view")); with none to show, the whole card is hidden. The
 * counts come from the same service as the sidebar pills. An unknown count shows "—", never 0. When every count is 0 the card
 * says "All clear".
 *
 * Props:
 * - counts: the four counts, or null when unavailable (rows then show "—")
 * - loading: show the skeleton with the same size
 * - notConnected: real-API mode: the two queues with a live source show their counts; the others say "Not available yet" (not a bare dash)
 */
import Link from "next/link";
import { Flag, MessageSquareQuote, NotebookPen, ShieldCheck, type LucideIcon } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { IconTile } from "@/components/ui/IconTile";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Screen } from "@/config/permissions";
import { hrefForScreen } from "@/lib/nav";
import type { AttentionCounts } from "@/lib/services/dashboard-types";

const ROWS: { key: keyof AttentionCounts; label: string; screen: Screen; icon: LucideIcon }[] = [
  { key: "pendingVerifications", label: "Pending verifications", screen: "verification", icon: ShieldCheck },
  { key: "openReports", label: "Open reports", screen: "reports_queue", icon: Flag },
  { key: "pendingTestimonials", label: "Pending testimonials", screen: "testimonials", icon: MessageSquareQuote },
  { key: "draftListings", label: "Unvetted draft listings", screen: "opportunities_queue", icon: NotebookPen },
];

function Row({ href, icon, label, count, testId, noSource = false }: { href: string; icon: LucideIcon; label: string; count: number | null; testId: string; noSource?: boolean }) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="flex items-center gap-3 rounded-control border border-white/10 bg-white/10 px-4 py-3 transition-colors duration-150 ease-out hover:bg-white/15"
    >
      <IconTile icon={icon} tone="dark" size="sm" />
      <span className="min-w-0 flex-1">
        <span className="body-sm block font-medium text-sb-text">{label}</span>
        {noSource && <span className="caption block text-sb-muted">Not available yet</span>}
      </span>
      {!noSource && (
        <span className="font-display text-xl font-bold tabular-nums text-white">
          {count === null ? (
            <span role="img" aria-label="unavailable">
              —
            </span>
          ) : (
            count.toLocaleString("en-US")
          )}
        </span>
      )}
    </Link>
  );
}

/** The queues the live API reports. All four now have live backend sources. */
const LIVE_KEYS: (keyof AttentionCounts)[] = ["pendingVerifications", "openReports", "pendingTestimonials", "draftListings"];

export function NeedsAttentionCard({ counts, loading, notConnected = false }: { counts: AttentionCounts | null; loading: boolean; notConnected?: boolean }) {
  const { can } = useRoles();
  const rows = ROWS.filter((row) => can(row.screen, "view"));
  if (rows.length === 0) return null;
  const allClear = !!counts && !notConnected && rows.every((row) => counts[row.key] === 0);

  return (
    <section aria-label="Needs your attention" data-testid="needs-attention" className="dark-feature dark-surface rounded-card p-5 shadow-card">
      <h2 className="font-display text-base font-bold leading-5.5 text-white">Needs your attention</h2>
      <p className="caption mt-1 text-sb-muted">{allClear ? "All clear: nothing is waiting on you." : "Items waiting on a decision"}</p>
      {loading ? (
        <div className="mt-4 grid gap-3 min-[640px]:grid-cols-2 min-[1025px]:grid-cols-4" aria-busy="true" aria-label="Loading items that need attention">
          {rows.map((row) => (
            <Skeleton key={row.key} onDark className="h-15.5 w-full rounded-control" />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 min-[640px]:grid-cols-2 min-[1025px]:grid-cols-4">
          {rows.map((row) => (
            <Row key={row.key} testId={`attention-${row.key}`} href={hrefForScreen(row.screen)} icon={row.icon} label={row.label} count={counts ? counts[row.key] : null} noSource={notConnected && !LIVE_KEYS.includes(row.key)} />
          ))}
        </div>
      )}
    </section>
  );
}
