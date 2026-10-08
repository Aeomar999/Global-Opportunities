"use client";

/**
 * Social (/social): the posts the desk logs by hand (there is no live platform API). Needs view access on "social".
 *
 * - From 1024px two columns (stacked below), the two cards the same height (the content of the shorter one is spread out): LEFT the "Log a post" card (LogPostCard: Platform, Post title, Post URL, Reach,
 *   Engagement, Linked opportunity, Date posted), RIGHT "Monthly totals" (MonthlyTotalsCard: Posts, Reach and Engagement as
 *   compact MiniStats with their targets, a per-platform table and a bar chart with the leading platform in orange) for the month
 *   chosen in the shared MonthSelect.
 * - Below: the month's posts, newest first: Title (with an external-link icon, opens the post in a new tab), Platform, Date,
 *   Reach, Engagement and the linked opportunity (a link only for a role that can view the Opportunities Queue).
 * - Roles: Social Media Manager, Desk Lead and Super Admin edit (they get the Log card); the Communications Officer and any role
 *   that only views see the totals and the list, and NO Log card at all (it is not rendered, not disabled).
 * - Everything comes from dated posts: logging one changes the totals, the platform table, the chart, the list and the Posts
 *   published, Social reach and Social engagement KPIs in the same render. A post dated in an earlier month changes THAT month
 *   (switch the month to see it). A past month is read-only.
 * Outside mock mode a notice says the page shows sample data (posts have no backend yet). The dev ?state=loading|empty|error
 * switch works.
 */
import { useCallback, useMemo } from "react";
import { ExternalLink, Share2 } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { RequireAccess } from "@/components/access/RequireAccess";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import type { Column } from "@/components/list/types";
import { LogPostCard } from "@/components/social/LogPostCard";
import { MonthlyTotalsCard } from "@/components/social/MonthlyTotalsCard";
import { PlatformBadge } from "@/components/social/PlatformBadge";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { TruncatedLink, TruncatedText } from "@/components/ui/TruncatedText";
import { formatDate, formatMonth } from "@/lib/format";
import { useMockCollection, useMockStoreVersion } from "@/lib/mock-store";
import { loadMonthPosts, socialMonth, subscribeSocial, toPostRows, type PostRow } from "@/lib/services/social";
import { useListData } from "@/lib/use-list-data";
import { useMonth } from "@/lib/use-month";

export default function SocialPage() {
  return (
    <RequireAccess screen="social">
      <SocialContent />
    </RequireAccess>
  );
}

function SocialContent() {
  const { month, isCurrent } = useMonth();
  const { can } = useRoles();
  const load = useCallback(() => loadMonthPosts(month), [month]);
  const { rows: loaded, isLoading, error, retry } = useListData(load, { subscribe: subscribeSocial });
  const posts = useMockCollection("socialPosts");
  const storeVersion = useMockStoreVersion();
  const canEdit = can("social", "edit");
  const linkOpportunity = can("opportunities_queue", "view");

  // The list and the totals work on the live store once the first load is done (a forced ?state=empty keeps the list empty).
  const rows = useMemo(() => (loaded === null ? null : loaded.length === 0 ? [] : toPostRows(posts, month)), [loaded, posts, month]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const totals = useMemo(() => (rows === null || (loaded !== null && loaded.length === 0) ? null : socialMonth(month)), [rows, loaded, month, storeVersion]);

  const columns: Column<PostRow>[] = [
    {
      key: "title",
      header: "Title",
      type: "custom",
      width: "30%",
      render: (r) =>
        r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`${r.title} (opens the post in a new tab)`} className="inline-flex max-w-full items-center gap-1.5 text-purple-700 hover:underline">
            <span className="min-w-0">
              <TruncatedText text={r.title} className="table-text font-semibold" />
            </span>
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
          </a>
        ) : (
          <TruncatedText text={r.title} className="table-text font-semibold" />
        ),
    },
    { key: "platform", header: "Platform", type: "custom", width: "16%", render: (r) => <PlatformBadge platform={r.platform} /> },
    { key: "date", header: "Date", type: "text", width: "12%", value: (r) => formatDate(r.postedAt) },
    { key: "reach", header: "Reach", type: "number", width: "10%", value: (r) => r.reach },
    { key: "engagement", header: "Engagement", type: "number", width: "11%", value: (r) => r.engagement },
    {
      key: "listing",
      header: "Linked listing",
      type: "custom",
      width: "21%",
      render: (r) => {
        if (!r.listingId || !r.listingTitle) return <span className="text-muted">—</span>;
        return linkOpportunity ? (
          <TruncatedLink href={`/opportunities/${r.listingId}`} text={r.listingTitle} lines={2} className="table-text text-purple-700 hover:underline" />
        ) : (
          <TruncatedText text={r.listingTitle} lines={2} className="table-text" />
        );
      },
    },
  ];

  return (
    <ListPage
      title="Social"
      subtitle="Log the desk's social media posts and see what they reached."
      toolbar={
        <div className="space-y-4">
          <NotConnectedNotice />
          <div className={canEdit ? "grid gap-4 lg:grid-cols-2 lg:items-stretch" : "grid gap-4"}>
            {canEdit && (
              <div className="flex min-w-0 flex-col">
                <LogPostCard />
              </div>
            )}
            <div className="flex min-w-0 flex-col">
              <MonthlyTotalsCard totals={totals} month={month} isCurrent={isCurrent} />
            </div>
          </div>
          <h2 className="card-title">Posts in {formatMonth(month)}</h2>
        </div>
      }
    >
      <DataTable
        label="Posts"
        columns={columns}
        rows={rows ?? []}
        getRowKey={(r) => r.id}
        loading={isLoading}
        error={error}
        onRetry={retry}
        resetKey={month}
        emptyNoData={{ icon: Share2, title: `No posts logged for ${formatMonth(month)}`, description: "Posts you log appear here, newest first." }}
        emptyNoResults={{ icon: Share2, title: "No posts to show" }}
      />
    </ListPage>
  );
}
