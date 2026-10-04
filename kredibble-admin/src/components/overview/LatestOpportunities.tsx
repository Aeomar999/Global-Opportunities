/**
 * LatestOpportunities: the three newest postings (same records as the
 * Opportunities Queue) with a "View all" link.
 *
 * Columns: Opportunity (title + company), Type, Status, Posted.
 * Below 640px the table turns into stacked cards: each cell becomes a
 * "Label  value" line (the label comes from the cell's data-label attribute).
 *
 * Props:
 * - data: rows, or null when unavailable
 * - loading: show the skeleton with three rows
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LatestOpportunity } from "@/lib/services/overview";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TruncatedLink, TruncatedText } from "@/components/ui/TruncatedText";
import { UnavailableNote } from "./UnavailableNote";

const TYPE_LABELS: Record<string, string> = {
  jobs: "Job",
  internships: "Internship",
  events: "Event",
  grants: "Grant",
};

const HEADERS = ["Opportunity", "Type", "Status", "Posted"];

// Cell layout shared by all four columns; max-sm turns each into a labelled line.
const CELL =
  "px-3 py-4 align-middle max-sm:flex max-sm:items-center max-sm:justify-between max-sm:gap-4 max-sm:px-0 max-sm:py-1 " +
  "max-sm:before:text-xs max-sm:before:font-semibold max-sm:before:text-muted max-sm:before:content-[attr(data-label)]";

interface LatestOpportunitiesProps {
  data: LatestOpportunity[] | null;
  loading: boolean;
  className?: string;
}

export function LatestOpportunities({ data, loading, className }: LatestOpportunitiesProps) {
  return (
    <Card as="section" ariaLabel="Latest opportunities" className={`flex flex-col ${className ?? ""}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="card-title">Latest opportunities</h2>
          <p className="text-sm text-muted">Newest postings awaiting or past review</p>
        </div>
        <Link
          href="/opportunities"
          className="inline-flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-control px-2 text-sm font-semibold text-orange-700 hover:underline"
        >
          View all
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div aria-busy="true" aria-label="Loading latest opportunities">
          <Skeleton className="h-10 w-full rounded-inset" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-17.25 items-center gap-6 border-b border-line last:border-0">
              <Skeleton className="h-9 w-2/5" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-6 w-24 rounded-pill" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      ) : !data ? (
        <div className="min-h-61.5 flex-1">
          <UnavailableNote />
        </div>
      ) : data.length === 0 ? (
        <p className="flex min-h-40 flex-1 items-center justify-center text-center text-sm text-muted">
          No opportunities have been posted yet.
        </p>
      ) : (
        <table className="w-full text-left max-sm:block">
          <thead className="max-sm:sr-only">
            <tr className="bg-canvas">
              {HEADERS.map((header) => (
                <th key={header} scope="col" className="eyebrow px-3 py-3 first:rounded-l-control last:rounded-r-control">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {data.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0 max-sm:block max-sm:py-3">
                <td className={CELL} data-label="Opportunity">
                  <div className="min-w-0">
                    <TruncatedLink href={`/opportunities/${row.id}`} text={row.title} className="text-sm font-semibold text-ink hover:underline max-sm:py-2.5" />
                    <TruncatedText text={row.company} className="caption" />
                  </div>
                </td>
                <td className={`${CELL} text-sm text-ink`} data-label="Type">
                  {TYPE_LABELS[row.type] ?? row.type}
                </td>
                <td className={CELL} data-label="Status">
                  <StatusBadge status={row.status} />
                </td>
                <td className={`${CELL} text-sm text-ink`} data-label="Posted">
                  {row.posted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
