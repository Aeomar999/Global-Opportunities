"use client";

/**
 * Leaderboard (/leaderboard): a READ-ONLY ranked table of the ambassadors for the month chosen in the shared MonthSelect.
 *
 * - Columns: Rank, Name, Country, Campus, Tier, Shares logged, Distinct referred clicks, Verified signups attributed.
 * - Order: verified signups, then referred clicks, then shares logged (highest first); a full tie is broken by name.
 * - The top three have purple-tinted rank badges; the rank is always a number in text, so the badge is never the only signal.
 * - NO edit actions at all: the only control on the page is the month select. A row links to the ambassador only when the
 *   viewer can view Network (otherwise the name is plain text and there is no arrow column).
 * - A past month is a snapshot: it is worked out from the dated shares and signups of that month and never changes.
 * Everyone with leaderboard access sees this page the same way. Outside mock mode a notice says it shows sample data.
 * The dev ?state=loading|empty|error switch works here.
 */
import { useCallback } from "react";
import { Trophy } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import type { Column } from "@/components/list/types";
import { Avatar } from "@/components/ui/Avatar";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { TagPill } from "@/components/ui/TagPill";
import { TruncatedLink, TruncatedText } from "@/components/ui/TruncatedText";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { cn } from "@/lib/cn";
import { formatMonth } from "@/lib/format";
import { AMBASSADOR_TIER_LABELS, AMBASSADOR_TIER_SHORT_LABELS } from "@/lib/mock-entities";
import { loadLeaderboard, subscribeNetwork, type LeaderboardRow } from "@/lib/services/network";
import { useListData } from "@/lib/use-list-data";
import { useMonth } from "@/lib/use-month";

/** The rank as a number in a badge: purple-tinted for the top three, plain for the rest. */
function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      data-testid="rank-badge"
      data-top={rank <= 3 ? "true" : "false"}
      aria-label={`Rank ${rank}`}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-pill font-display text-sm font-bold tabular-nums",
        rank <= 3 ? "bg-purple-50 text-purple-700 ring-1 ring-purple-200" : "text-muted",
      )}
    >
      {rank}
    </span>
  );
}

const COLUMNS: Column<LeaderboardRow>[] = [
  { key: "rank", header: "Rank", type: "custom", width: "8%", render: (r) => <RankBadge rank={r.rank} /> },
  { key: "name", header: "Name", type: "primary", width: "22%", title: (r) => r.ambassador.name, leading: (r) => ({ avatarName: r.ambassador.name, imageSrc: r.ambassador.photoUrl }) },
  { key: "country", header: "Country", type: "text", width: "11%", value: (r) => r.ambassador.country },
  { key: "campus", header: "Campus", type: "text", width: "14%", value: (r) => r.ambassador.campus },
  { key: "tier", header: "Tier", type: "pill", width: "14%", label: (r) => AMBASSADOR_TIER_SHORT_LABELS[r.ambassador.tier], tooltip: (r) => AMBASSADOR_TIER_LABELS[r.ambassador.tier] },
  { key: "shares", header: "Shares logged", type: "number", width: "10%", value: (r) => r.shares },
  { key: "clicks", header: "Distinct referred clicks", type: "number", width: "11%", value: (r) => r.clicks },
  { key: "signups", header: "Verified signups attributed", type: "number", width: "10%", value: (r) => r.signups },
];

/** The compact card for phones: rank, avatar, name and tier on one row, then the place, then the three figures with their labels. */
function LeaderCard({ row, linked }: { row: LeaderboardRow; linked: boolean }) {
  const { ambassador } = row;
  return (
    <div data-testid="leader-card" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <RankBadge rank={row.rank} />
          <Avatar name={ambassador.name} size="sm" />
          {linked ? (
            <TruncatedLink
              href={`/network/${ambassador.id}`}
              text={ambassador.name}
              className="table-text font-semibold text-ink outline-none after:absolute after:inset-0 after:rounded-inset focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
            />
          ) : (
            <TruncatedText text={ambassador.name} className="table-text font-semibold text-ink" />
          )}
        </div>
        <TagPill className="whitespace-nowrap">{AMBASSADOR_TIER_SHORT_LABELS[ambassador.tier]}</TagPill>
      </div>
      <TruncatedText text={`${ambassador.country} · ${ambassador.campus}`} className="caption text-ink" />
      <p className="caption tabular-nums">
        Shares {row.shares} · Referred clicks {row.clicks} · Verified signups {row.signups}
      </p>
    </div>
  );
}

export default function LeaderboardPage() {
  const { month, isCurrent } = useMonth();
  const { can } = useRoles();
  const load = useCallback(() => loadLeaderboard(month), [month]);
  const { rows, isLoading, error, retry } = useListData(load, { subscribe: subscribeNetwork });

  return (
    <ListPage
      title="Leaderboard"
      subtitle="Ambassadors ranked by verified signups, then referred clicks, then shares logged."
      toolbar={
        <div className="space-y-3">
          <NotConnectedNotice />
          <div className="flex flex-wrap items-center gap-3">
            <MonthSelect />
            <p data-testid="leaderboard-note" role="status" className="caption">
              {isCurrent ? "This month so far." : `A snapshot of ${formatMonth(month)}: these figures are fixed and read-only.`}
            </p>
          </div>
        </div>
      }
    >
      <DataTable
        label="Leaderboard"
        columns={COLUMNS}
        rows={rows ?? []}
        getRowKey={(r) => r.ambassador.id}
        // A row opens the ambassador only for someone who may see the Network page.
        getRowHref={can("network", "view") ? (r) => `/network/${r.ambassador.id}` : undefined}
        renderCard={(r) => <LeaderCard row={r} linked={can("network", "view")} />}
        loading={isLoading}
        error={error}
        onRetry={retry}
        // Everyone fits on one page, so there is no pager (no buttons) under the table.
        pageSize={100}
        resetKey={month}
        emptyNoData={{ icon: Trophy, title: "No ambassadors to rank", description: "Ambassadors who have joined appear here with their numbers for the month." }}
        emptyNoResults={{ icon: Trophy, title: "Nobody to show" }}
      />
    </ListPage>
  );
}
