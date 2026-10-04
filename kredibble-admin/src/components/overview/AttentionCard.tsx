/**
 * AttentionCard: the ONE dark feature card on the Overview ("Needs your
 * attention"). Violet-black to purple gradient with a soft orange glow along
 * the bottom edge, frosted rows for the two things waiting on a person
 * (pending verifications, open reports) and an orange "Review now" button.
 *
 * Each row is a link to its queue. "Review now" goes to the verification queue
 * when anything is pending there, otherwise to the reports queue.
 *
 * Props:
 * - pendingVerifications / openReports: counts, or null when unknown
 *   (shown as "—", never as 0)
 * - loading: show the skeleton with the same shape
 */
import Link from "next/link";
import { ArrowRight, Flag, ShieldCheck, type LucideIcon } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/IconTile";
import { Skeleton } from "@/components/ui/Skeleton";

interface AttentionCardProps {
  pendingVerifications: number | null;
  openReports: number | null;
  loading: boolean;
}

interface RowProps {
  href: string;
  icon: LucideIcon;
  label: string;
  count: number | null;
}

/** One frosted row: icon, label and the count on the right. */
function AttentionRow({ href, icon, label, count }: RowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-control border border-white/10 bg-white/10 px-4 py-3 transition-colors duration-150 ease-out hover:bg-white/15"
    >
      <IconTile icon={icon} tone="dark" size="sm" />
      <span className="body-sm flex-1 font-medium text-sb-text">{label}</span>
      <span className="font-display text-xl font-bold tabular-nums text-white">
        {count === null ? (
          <span role="img" aria-label="unavailable">
            —
          </span>
        ) : (
          count.toLocaleString("en-US")
        )}
      </span>
    </Link>
  );
}

export function AttentionCard({ pendingVerifications, openReports, loading }: AttentionCardProps) {
  const allClear = pendingVerifications === 0 && openReports === 0;
  const reviewHref = pendingVerifications ? "/verification" : "/reports";

  return (
    // Flex column that fills its row (h-full): the title and rows sit at the top and "Review now" is
    // pinned to the bottom, so this card ends on the same line as "Latest opportunities".
    <section
      aria-label="Needs your attention"
      className="dark-feature dark-surface flex h-full flex-col justify-between gap-4 rounded-card p-5 shadow-card"
    >
      <div>
        <h2 className="font-display text-base font-bold leading-5.5 text-white">Needs your attention</h2>
        <p className="caption mt-1 text-sb-muted">Items waiting on a decision</p>

        {loading ? (
          <div className="mt-4 space-y-3" aria-busy="true" aria-label="Loading items that need attention">
            <Skeleton onDark className="h-15.5 w-full rounded-control" />
            <Skeleton onDark className="h-15.5 w-full rounded-control" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <AttentionRow href="/verification" icon={ShieldCheck} label="Pending verifications" count={pendingVerifications} />
            <AttentionRow href="/reports" icon={Flag} label="Open reports" count={openReports} />
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton onDark className="h-10 w-full rounded-control" />
      ) : allClear ? (
        <p className="body-sm rounded-control px-1 text-sb-muted">All clear: nothing is waiting on you.</p>
      ) : (
        <Link href={reviewHref} className={`${buttonClasses("primary")} w-full`}>
          Review now
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}
