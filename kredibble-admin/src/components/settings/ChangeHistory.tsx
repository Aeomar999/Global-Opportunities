"use client";

/**
 * ChangeHistory: the "Change history" card under the targets on Settings > Targets.
 *
 *   Date          What changed              Old     New      Effective from   Changed by
 *   7 Oct 2026    Social reach target       10,500  12,000   October 2026     Nana Adjei
 *   7 Oct 2026    Status thresholds         Green 95%, amber 70%   Green 90%, amber 60%   October 2026   Nana Adjei
 *
 * Every saved change to a target or to the thresholds, in ONE list, newest first (the one saved last first). It shows 10 rows and a "Show more"
 * button that adds 10 at a time; with no change yet it says "No changes yet". Rows are never edited or deleted: it is the record of what was set,
 * when, by whom and from which month. Below 640px each change is a stacked card (no table to scroll sideways).
 *
 * Props: rows (from changeHistory() in services/settings.ts)
 */
import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatMonth } from "@/lib/format";
import { useMediaQuery } from "@/lib/use-media-query";
import type { HistoryRow } from "@/lib/services/settings";

const PAGE = 10;

/** The tag on a row that a later save for the same month replaced (the row stays and keeps its values). */
function ReplacedTag() {
  return (
    <span data-testid="replaced-tag" className="rounded-full border border-line px-2 py-px text-xs font-medium text-muted">
      Replaced
    </span>
  );
}

export function ChangeHistory({ rows }: { rows: HistoryRow[] }) {
  const phone = useMediaQuery("(max-width: 639px)");
  const [shown, setShown] = useState(PAGE);
  const visible = rows.slice(0, shown);

  return (
    <Card as="section" ariaLabel="Change history" testId="change-history">
      <CardHeader title="Change history" subtitle="Every change to a target or to the thresholds: what it was, what it became, from which month and who saved it." />
      {rows.length === 0 ? (
        <EmptyState icon={History} title="No changes yet" description="When someone saves a new target or new thresholds, it is listed here." />
      ) : (
        <>
          {phone ? (
            <ul data-testid="history-list" className="divide-y divide-line">
              {visible.map((row) => (
                <li key={row.id} data-testid="history-row" data-replaced={row.replaced || undefined} className="py-3 first:pt-0 last:pb-0">
                  <p className={`table-text flex flex-wrap items-center gap-x-2 font-semibold ${row.replaced ? "text-muted!" : ""}`}>
                    {row.what}
                    {row.replaced && <ReplacedTag />}
                  </p>
                  <p data-testid="history-summary" className="caption">{row.summary}</p>
                  <p className="caption">
                    {formatDate(row.changedAt)} · {row.changedBy}
                  </p>
                  <p className={`body-sm mt-1 text-ink ${row.replaced ? "text-muted!" : ""}`}>
                    {row.oldValue} <span aria-hidden="true">→</span> <span className="sr-only">to</span> {row.newValue}
                  </p>
                  <p className="caption">From {formatMonth(row.effectiveFrom)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <table data-testid="history-table" className="w-full table-fixed text-left">
              <caption className="sr-only">Changes to targets and thresholds, newest first</caption>
              <thead>
                <tr className="table-head">
                  <th scope="col" className="w-[13%] py-2 pr-3">Date</th>
                  <th scope="col" className="w-[22%] px-3 py-2">What changed</th>
                  <th scope="col" className="w-[18%] px-3 py-2">Old</th>
                  <th scope="col" className="w-[18%] px-3 py-2">New</th>
                  <th scope="col" className="w-[15%] px-3 py-2">Effective from</th>
                  <th scope="col" className="w-[14%] py-2 pl-3">Changed by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((row) => (
                  <tr key={row.id} data-testid="history-row" data-replaced={row.replaced || undefined} className="align-top">
                    <td className={`table-text py-2.5 pr-3 tabular-nums ${row.replaced ? "text-muted!" : ""}`}>{formatDate(row.changedAt)}</td>
                    <td className={`table-text px-3 py-2.5 ${row.replaced ? "text-muted!" : ""}`}>
                      <span className="flex flex-wrap items-center gap-x-2 font-semibold">
                        {row.what}
                        {row.replaced && <ReplacedTag />}
                      </span>
                      <span data-testid="history-summary" className="caption block">{row.summary}</span>
                    </td>
                    <td className={`table-text px-3 py-2.5 tabular-nums ${row.replaced ? "text-muted!" : ""}`}>{row.oldValue}</td>
                    <td className={`table-text px-3 py-2.5 tabular-nums ${row.replaced ? "text-muted!" : ""}`}>{row.newValue}</td>
                    <td className={`table-text px-3 py-2.5 ${row.replaced ? "text-muted!" : ""}`}>{formatMonth(row.effectiveFrom)}</td>
                    <td className={`table-text py-2.5 pl-3 ${row.replaced ? "text-muted!" : ""}`}>{row.changedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p data-testid="history-count" className="caption" aria-live="polite">
              Showing {visible.length} of {rows.length}
            </p>
            {rows.length > shown && (
              <Button type="button" variant="secondary" onClick={() => setShown((count) => count + PAGE)}>
                Show more
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
