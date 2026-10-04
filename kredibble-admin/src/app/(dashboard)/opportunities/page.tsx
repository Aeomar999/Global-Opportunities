"use client";

/**
 * Opportunities Queue: Jobs, Internships, Events and Grants posted by hirers, awaiting moderation.
 * Built on the shared list template; this file holds the column config, the type filter and the
 * data loader.
 *
 * Data: loadOpportunityRows() in src/lib/services/opportunities.ts (mock data in mock mode, every page of
 * GET /admin/opportunities in real mode). Everything loads once; the type filter and its counts are computed here.
 * Type labels and icons come from src/lib/opportunity-types.ts, shared with the review page.
 * A failed request shows inline with "Try again".
 */
import { useMemo, useState } from "react";
import { Briefcase } from "lucide-react";
import { formatDate } from "@/lib/format";
import { opportunityTypeMeta } from "@/lib/opportunity-types";
import { loadOpportunityRows, type OpportunityRow } from "@/lib/services/opportunities";
import { subscribeMockStore } from "@/lib/mock-store";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";

type Filter = "all" | "jobs" | "internships" | "events" | "grants";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "jobs", label: "Jobs" },
  { value: "internships", label: "Internships" },
  { value: "events", label: "Events" },
  { value: "grants", label: "Grants" },
];

const COLUMNS: Column<OpportunityRow>[] = [
  { key: "title", header: "Title", type: "primary", width: "30%", title: (r) => r.title, subtitle: (r) => `${r.applicantsCount} applied` },
  { key: "company", header: "Company", type: "text", width: "20%", value: (r) => r.company },
  {
    key: "type",
    header: "Type",
    type: "text",
    width: "15%",
    value: (r) => opportunityTypeMeta(r.type).label,
    icon: (r) => opportunityTypeMeta(r.type).icon,
  },
  { key: "posted", header: "Posted", type: "text", width: "15%", value: (r) => formatDate(r.date) },
  { key: "status", header: "Status", type: "status", width: "20%", status: (r) => r.moderationStatus },
];

export default function OpportunitiesQueuePage() {
  const { rows, isLoading, error, retry } = useListData(loadOpportunityRows, { subscribe: subscribeMockStore });
  const [filter, setFilter] = useState<Filter>("all");

  const all = useMemo(() => rows ?? [], [rows]);
  const options = FILTERS.map((f) => ({
    ...f,
    count: rows ? (f.value === "all" ? all.length : all.filter((r) => r.type === f.value).length) : undefined,
  }));
  const visible = filter === "all" ? all : all.filter((r) => r.type === filter);
  const pendingCount = all.filter((r) => r.moderationStatus === "pending").length;

  return (
    <ListPage
      title="Opportunities Queue"
      subtitle={`Review Jobs, Internships, Events, and Grants posted by hirers.${rows ? ` ${pendingCount} awaiting review.` : ""}`}
      toolbar={<TableToolbar filters={{ options, value: filter, onChange: setFilter, label: "Filter by type" }} />}
    >
      <DataTable
        label="Opportunities"
        columns={COLUMNS}
        rows={visible}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/opportunities/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        isFiltered={filter !== "all"}
        resetKey={filter}
        emptyNoData={{ icon: Briefcase, title: "No opportunities posted yet", description: "Postings from hirers appear here for moderation." }}
        emptyNoResults={{ icon: Briefcase, title: "No opportunities in this category", description: "Try another type, or choose All." }}
      />
    </ListPage>
  );
}
