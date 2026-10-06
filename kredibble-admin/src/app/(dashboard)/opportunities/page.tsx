"use client";

/**
 * Opportunities Queue: ONE list for everything that can become an opportunity on the platform.
 *   - Hirer-submitted postings (Jobs, Internships, Events, Grants), moderated here: pending, approved, rejected.
 *   - Staff-curated listings (also scholarships and fellowships), made by the desk: draft or published, and gated by
 *     vetting ("Listings must be vetted before they can be published").
 * Built on the shared list template; this file holds the column config, the filters and the data loader.
 *
 * Filters (all combine; counts on the type tabs follow the other filters):
 *   - Type tabs: All, Jobs, Internships, Events, Grants, Other (scholarships, fellowships)
 *   - Source: All, Hirer-submitted, Staff-curated (SegmentedControl)
 *   - Country and Status (the custom Select; Status lists the moderation and the listing statuses)
 * Columns: Title, Company, Type, Source (pill), Vetting (curated rows only, "—" for hirer postings), Posted, Status.
 * "New listing" (primary) needs EDIT access on listings_curate: Opportunities Officer, Desk Lead, Super Admin. Everyone
 * else who can open the page (a Moderator, for instance) reviews hirer postings and sees no such button.
 *
 * In real-API mode a muted note under the header says curated listings are only kept in memory for now (mock mode
 * shows nothing).
 *
 * Data: loadOpportunityRows() (services/opportunities.ts) merges the hirer postings (mock, or every page of
 * GET /admin/opportunities) with the curated listings of the shared store. Everything loads once; filtering is done here. A failed request shows inline with "Try again".
 */
import { useMemo, useState } from "react";
import { Briefcase, Plus } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { isMockMode } from "@/lib/services/mock-mode";
import { formatDate } from "@/lib/format";
import { opportunityTypeMeta } from "@/lib/opportunity-types";
import { loadOpportunityRows, type OpportunityRow, type OpportunitySource } from "@/lib/services/opportunities";
import { subscribeMockStore } from "@/lib/mock-store";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

/** The tabs. "Other" holds every type that has no tab of its own (scholarships, fellowships, competitions, trainings...). */
type TypeTab = "all" | "jobs" | "internships" | "events" | "grants" | "other";
const OWN_TABS = ["jobs", "internships", "events", "grants"];
const TABS: { value: TypeTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "jobs", label: "Jobs" },
  { value: "internships", label: "Internships" },
  { value: "events", label: "Events" },
  { value: "grants", label: "Grants" },
  { value: "other", label: "Other" },
];
const inTab = (row: OpportunityRow, tab: TypeTab) => (tab === "all" ? true : tab === "other" ? !OWN_TABS.includes(row.type) : row.type === tab);

type SourceFilter = "all" | OpportunitySource;
const SOURCES: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hirer", label: "Hirer-submitted" },
  { value: "curated", label: "Staff-curated" },
];

const ALL = "all";
const STATUS_OPTIONS: SelectOption<string>[] = [
  { value: ALL, label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

const typeOf = (row: OpportunityRow) => opportunityTypeMeta(row.type);

const COLUMNS: Column<OpportunityRow>[] = [
  {
    key: "title",
    header: "Title",
    type: "primary",
    width: "24%",
    title: (r) => r.title,
    subtitle: (r) => (r.applicantsCount === undefined ? undefined : `${r.applicantsCount} applied`),
  },
  { key: "company", header: "Company", type: "text", width: "16%", value: (r) => r.company },
  { key: "type", header: "Type", type: "text", width: "12%", value: (r) => typeOf(r).label, icon: (r) => typeOf(r).icon },
  { key: "source", header: "Source", type: "pill", width: "12%", label: (r) => (r.source === "curated" ? "Staff-curated" : "Hirer") },
  { key: "vetting", header: "Vetting", type: "status", width: "11%", status: (r) => r.vetting },
  { key: "posted", header: "Posted", type: "text", width: "11%", value: (r) => formatDate(r.date) },
  { key: "status", header: "Status", type: "status", width: "14%", status: (r) => r.moderationStatus },
];

export default function OpportunitiesQueuePage() {
  const { rows, isLoading, error, retry } = useListData(loadOpportunityRows, { subscribe: subscribeMockStore });
  const { can } = useRoles();
  const [tab, setTab] = useState<TypeTab>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [country, setCountry] = useState(ALL);
  const [status, setStatus] = useState(ALL);

  const all = useMemo(() => rows ?? [], [rows]);
  const countryOptions: SelectOption<string>[] = useMemo(
    () => [
      { value: ALL, label: "All countries" },
      ...[...new Set(all.map((row) => row.country).filter((name): name is string => !!name))].sort().map((name) => ({ value: name, label: name })),
    ],
    [all],
  );

  // Source, Country and Status first; the type tabs and their counts then work on what is left.
  const scoped = all.filter(
    (row) => (source === "all" || row.source === source) && (country === ALL || row.country === country) && (status === ALL || row.moderationStatus === status),
  );
  const visible = scoped.filter((row) => inTab(row, tab));
  const options = TABS.map((entry) => ({
    value: entry.value,
    label: entry.label,
    count: rows ? scoped.filter((row) => inTab(row, entry.value)).length : undefined,
  }));
  const pendingCount = all.filter((row) => row.source === "hirer" && row.moderationStatus === "pending").length;
  const filtered = tab !== "all" || source !== "all" || country !== ALL || status !== ALL;

  return (
    <ListPage
      title="Opportunities Queue"
      subtitle={`Review postings from hirers and manage the listings the desk curates.${rows ? ` ${pendingCount} awaiting review.` : ""}`}
      action={can("listings_curate", "edit") ? { label: "New listing", href: "/opportunities/new", icon: Plus } : undefined}
      toolbar={
        <div className="space-y-3">
          {/* Mock-mode values are constants, so reading them during render is safe (no hydration mismatch). */}
          {!isMockMode() && (
            <p data-testid="curated-memory-note" className="caption">
              Curated listings are saved in memory until the backend supports them.
            </p>
          )}
          <TableToolbar filters={{ options, value: tab, onChange: setTab, label: "Filter by type" }}>
            <SegmentedControl options={SOURCES} value={source} onChange={setSource} ariaLabel="Filter by source" />
            <Select options={countryOptions} value={country} onChange={setCountry} ariaLabel="Filter by country" sheetTitle="Country" className="w-fit" />
            <Select options={STATUS_OPTIONS} value={status} onChange={setStatus} ariaLabel="Filter by status" sheetTitle="Status" className="w-fit" />
          </TableToolbar>
        </div>
      }
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
        isFiltered={filtered}
        resetKey={`${tab}|${source}|${country}|${status}`}
        emptyNoData={{ icon: Briefcase, title: "No opportunities yet", description: "Postings from hirers and the desk's own listings appear here." }}
        emptyNoResults={{ icon: Briefcase, title: "No opportunities match these filters", description: "Try another type, source, country or status." }}
      />
    </ListPage>
  );
}
