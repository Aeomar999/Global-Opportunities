"use client";

/**
 * LinkedCell: the "Linked" column of the records list. The ambassador who referred the person and the opportunity they came
 * in through, each on its own line. A name is a link ONLY for a role that can view that page (Network, the Opportunities
 * Queue: see recordLinkAccess in services/database.ts); for any other role it is plain text. Nothing linked shows "—".
 * The links sit above the row's stretched link (relative z-10), so they open their own page and not the record. Any name that
 * is cut off with an ellipsis (link or plain) shows in full in the shared Tooltip, on hover and keyboard focus.
 *
 * Props: record (a RecordRow), access ({ ambassador, opportunity }: which links the viewer may follow), single? (phone cards: only the
 * first linked item, the ambassador or else the opportunity, on one line)
 */
import { TruncatedLink, TruncatedText } from "@/components/ui/TruncatedText";
import type { RecordRow } from "@/lib/services/database";

const LINK = "relative z-10 text-purple-700 hover:underline";

export function LinkedCell({ record, access, single = false }: { record: RecordRow; access: { ambassador: boolean; opportunity: boolean }; single?: boolean }) {
  const ambassador = record.ambassadorId ? (record.ambassadorName ?? "Ambassador") : null;
  const opportunity = single && ambassador ? null : record.listingId ? (record.listingTitle ?? "Opportunity") : null;
  if (!ambassador && !opportunity) return <span className="text-muted">—</span>;
  return (
    <div className="min-w-0 space-y-0.5">
      {ambassador &&
        (access.ambassador ? (
          <TruncatedLink testId="linked-ambassador" href={`/network/${record.ambassadorId}`} text={ambassador} className={`${LINK} table-text`} />
        ) : (
          <div data-testid="linked-ambassador">
            <TruncatedText text={ambassador} className="table-text" />
          </div>
        ))}
      {opportunity &&
        (access.opportunity ? (
          <TruncatedLink testId="linked-opportunity" href={`/opportunities/${record.listingId}`} text={opportunity} className={`${LINK} caption`} />
        ) : (
          <div data-testid="linked-opportunity">
            <TruncatedText text={opportunity} className="caption" />
          </div>
        ))}
    </div>
  );
}
