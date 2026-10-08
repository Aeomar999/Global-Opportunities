"use client";

/**
 * MonthlyTotalsCard: the "Monthly totals" card on /social, for the month chosen in the shared MonthSelect.
 *
 *   Monthly totals                                         [ October 2026 v ]
 *   [ 9 Posts | Target 8 ] [ 8,420 Reach | Target 10,500 ] [ 610 Engagement | Target 800 ]    <- compact MiniStats with captions
 *   Platform      Posts   Reach   Engagement                                                  <- the platforms that have a post, the
 *   Instagram       3     3,120      240   Leading                                                leader (most reach) first
 *   ...
 *   [ a bar chart of reach per platform: the leading platform is the orange bar ]
 *
 * The three totals come from kpiValue (the same functions as the KPIs); the platform rows are summed from the same dated posts,
 * so they add up to the totals. A past month is a READ-ONLY snapshot (a line says so): nothing here edits a post.
 * A month with no post shows "No posts logged for <month>" and no table or chart. While loading every figure is "—", never 0.
 *
 * Props: totals (the result of socialMonth(), or null while loading), month (the selected month), isCurrent
 * Test ids: social-totals, total-posts, total-reach, total-engagement, platform-table, platform-row-<platform>, leading-platform.
 */
import { BarChart3 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { HighlightBarChart } from "@/components/ui/HighlightBarChart";
import { MiniStat } from "@/components/ui/MiniStat";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { PlatformBadge } from "@/components/social/PlatformBadge";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { formatMonth } from "@/lib/format";
import type { MonthKey } from "@/lib/mock-entities";
import type { SocialMonth } from "@/lib/services/social";

const number = (value: number) => value.toLocaleString("en-US");

/**
 * PlatformBars: reach by platform as horizontal bars (the platform's name, a bar, its figure). The leading platform's bar is orange,
 * the others purple. A bar is as long as its share of the leader's reach. With leaderLabelOnly (phones) only the leader shows its
 * figure, the others are in the list above, so nothing crowds.
 */
function PlatformBars({ platforms, leading, leaderLabelOnly, ariaLabel }: { platforms: SocialMonth["platforms"]; leading: SocialMonth["leading"]; leaderLabelOnly: boolean; ariaLabel: string }) {
  const max = Math.max(...platforms.map((row) => row.reach), 1);
  return (
    <ul data-testid="platform-bars" aria-label={ariaLabel} className="space-y-2">
      {platforms.map((row) => {
        const isLeader = row.platform === leading;
        return (
          <li key={row.platform} data-testid={`platform-bar-${row.platform}`} data-leading={isLeader ? "true" : "false"} className="flex items-center gap-3">
            <span className="caption w-20 shrink-0 truncate text-ink">{row.label}</span>
            <span aria-hidden="true" className="h-3 min-w-0 flex-1 rounded-pill bg-surface-2">
              <span className={cn("block h-full rounded-pill", isLeader ? "bg-orange-500" : "bg-purple-300")} style={{ width: `${Math.max(2, (row.reach / max) * 100)}%` }} />
            </span>
            <span className={cn("caption w-14 shrink-0 text-right tabular-nums", isLeader ? "font-semibold text-ink" : "text-muted")}>
              {leaderLabelOnly && !isLeader ? <span className="sr-only">{number(row.reach)}</span> : number(row.reach)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function MonthlyTotalsCard({ totals, month, isCurrent }: { totals: SocialMonth | null; month: MonthKey; isCurrent: boolean }) {
  const t = totals;
  const phone = useMediaQuery("(max-width: 639px)");
  // The chart reads left to right, so the leading platform goes LAST: the chart paints its last bar orange.
  const chartData = t ? [...t.platforms].reverse().map((row) => ({ label: row.label, tooltipLabel: row.label, value: row.reach })) : [];
  return (
    <Card as="section" ariaLabel="Monthly totals" className="flex min-w-0 flex-1 flex-col justify-between gap-4" testId="social-totals">
      <CardHeader title="Monthly totals" subtitle={isCurrent ? "This month so far." : `A snapshot of ${formatMonth(month)}: these figures are fixed and read-only.`} className="mb-0" action={<MonthSelect />} />

      {!isCurrent && (
        <p data-testid="history-note" className="caption -mt-1">
          Showing the targets and thresholds that applied in {formatMonth(month)}
        </p>
      )}

      <div className="grid gap-2 min-[1280px]:grid-cols-3">
        <div data-testid="total-posts">
          <MiniStat compact value={t ? t.posts : "—"} label="Posts" caption={t ? `Target ${number(t.targets.posts)}` : undefined} />
        </div>
        <div data-testid="total-reach">
          <MiniStat compact value={t ? number(t.reach) : "—"} label="Reach" caption={t ? `Target ${number(t.targets.reach)}` : undefined} />
        </div>
        <div data-testid="total-engagement">
          <MiniStat compact value={t ? number(t.engagement) : "—"} label="Engagement" caption={t ? `Target ${number(t.targets.engagement)}` : undefined} />
        </div>
      </div>

      {t && t.platforms.length === 0 && (
        <p data-testid="no-posts" className="body-sm flex items-center gap-2 text-muted">
          <BarChart3 size={16} strokeWidth={1.75} aria-hidden="true" />
          No posts logged for {formatMonth(month)}.
        </p>
      )}

      {t && t.platforms.length > 0 && (
        <>
          <div className="min-w-0">
            {phone ? (
              // Below 640px: stacked rows (no table to scroll sideways): the platform, then its three figures with their labels.
              <ul data-testid="platform-list" aria-label={`Posts, reach and engagement by platform in ${formatMonth(month)}`} className="divide-y divide-line">
                {t.platforms.map((row) => {
                  const leading = row.platform === t.leading;
                  return (
                    <li key={row.platform} data-testid={`platform-row-${row.platform}`} data-leading={leading ? "true" : "false"} className={cn("py-2", leading && "border-l-2 border-orange-500 pl-2")}>
                      <span className="flex flex-wrap items-center gap-2">
                        <PlatformBadge platform={row.platform} highlight={leading} />
                        {leading && (
                          <span data-testid="leading-platform" className="badge-text rounded-pill bg-orange-50 px-2 py-0.5 text-orange-700">
                            Leading
                          </span>
                        )}
                      </span>
                      <p className="caption mt-1 tabular-nums">
                        Posts {number(row.posts)} · Reach {number(row.reach)} · Engagement {number(row.engagement)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <table data-testid="platform-table" className="w-full text-left">
                <caption className="sr-only">Posts, reach and engagement by platform in {formatMonth(month)}</caption>
                <thead>
                  <tr className="caption">
                    <th scope="col" className="py-2 pr-3 font-semibold">Platform</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Posts</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Reach</th>
                    <th scope="col" className="py-2 pl-3 text-right font-semibold">Engagement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {t.platforms.map((row) => {
                    const leading = row.platform === t.leading;
                    return (
                      <tr key={row.platform} data-testid={`platform-row-${row.platform}`} data-leading={leading ? "true" : "false"}>
                        <th scope="row" className={cn("py-2 pr-3 font-normal", leading && "border-l-2 border-orange-500 pl-2")}>
                          <span className="flex items-center gap-2">
                            <PlatformBadge platform={row.platform} highlight={leading} />
                            {leading && (
                              <span data-testid="leading-platform" className="badge-text rounded-pill bg-orange-50 px-2 py-0.5 text-orange-700">
                                Leading
                              </span>
                            )}
                          </span>
                        </th>
                        <td className="table-text px-3 py-2 text-right tabular-nums">{number(row.posts)}</td>
                        <td className="table-text px-3 py-2 text-right tabular-nums">{number(row.reach)}</td>
                        <td className="table-text py-2 pl-3 text-right tabular-nums">{number(row.engagement)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          {/* The reach chart. Vertical bars when there are 2 to 4 platforms and room; horizontal bars below 640px and whenever more than
              four platforms have posts, so the labels never overlap and nothing scrolls sideways. */}
          {t.platforms.length >= 2 && (
            <div className="relative min-w-0 overflow-hidden">
              {phone || t.platforms.length > 4 ? (
                <PlatformBars platforms={t.platforms} leading={t.leading} leaderLabelOnly={phone} ariaLabel={`Reach by platform in ${formatMonth(month)}`} />
              ) : (
                <HighlightBarChart data={chartData} ariaLabel={`Reach by platform in ${formatMonth(month)}, the leading platform last`} unit="reach" />
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
