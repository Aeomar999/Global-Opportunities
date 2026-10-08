"use client";

/**
 * Network (/network): the ambassadors who amplify listings with their referral code (purple accent: Partners and Network are
 * purple). Built on the shared list template.
 *
 * - Summary (NetworkSummary, compact tiles with captions): Network size, Active, and Activity rate (active ambassadors who
 *   logged at least one share this month, divided by the active ones). They count ALL ambassadors, whatever the filters say.
 * - Columns: Ambassador (initials avatar, name, email), Country and city, Campus, Tier, Status badge, Trained (a check or a
 *   dash), Assigned lead.
 * - Filters (they combine): Status (SegmentedControl with counts), Tier and Country (the custom Select), and a search by name
 *   or campus. The status counts follow the other filters.
 * - "New ambassador" (primary) needs edit access on network: Country Lead, Desk Lead, Super Admin. The Partnerships, Training and
 *   Database officers can open the page and read it, and see no such button.
 * Outside mock mode a notice says the page shows sample data (ambassadors have no backend yet). The dev ?state=
 * loading|empty|error switch works here.
 */
import { useMemo, useState } from "react";
import { Check, Network as NetworkIcon, Plus } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";
import { NetworkSummary } from "@/components/network/NetworkSummary";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { AMBASSADOR_STATUSES, AMBASSADOR_TIERS, AMBASSADOR_TIER_LABELS, AMBASSADOR_TIER_SHORT_LABELS, type AmbassadorStatus, type AmbassadorTier } from "@/lib/mock-entities";
import { useMockCollection } from "@/lib/mock-store";
import { loadAmbassadorRows, subscribeNetwork, type AmbassadorRow } from "@/lib/services/network";
import { getStatusMeta } from "@/lib/status-map";
import { useListData } from "@/lib/use-list-data";

const ALL = "all";
type StatusFilter = "all" | AmbassadorStatus;

const COLUMNS: Column<AmbassadorRow>[] = [
  {
    key: "ambassador",
    header: "Ambassador",
    type: "primary",
    width: "24%",
    title: (r) => r.name,
    subtitle: (r) => r.email,
    leading: (r) => ({ avatarName: r.name, imageSrc: r.photoUrl }),
  },
  { key: "place", header: "Country and city", type: "text", width: "15%", value: (r) => `${r.city}, ${r.country}` },
  { key: "campus", header: "Campus", type: "text", width: "13%", value: (r) => r.campus },
  { key: "tier", header: "Tier", type: "pill", width: "14%", label: (r) => AMBASSADOR_TIER_SHORT_LABELS[r.tier], tooltip: (r) => AMBASSADOR_TIER_LABELS[r.tier] },
  { key: "status", header: "Status", type: "status", width: "10%", status: (r) => r.status },
  { key: "trained", header: "Trained", type: "text", width: "9%", value: (r) => (r.trained ? "Trained" : "—"), icon: (r) => (r.trained ? Check : undefined) },
  { key: "lead", header: "Assigned lead", type: "text", width: "15%", value: (r) => r.leadName ?? "—" },
];

export default function NetworkPage() {
  const { rows, isLoading, error, retry } = useListData(loadAmbassadorRows, { subscribe: subscribeNetwork });
  const logs = useMockCollection("amplificationLogs");
  const { can } = useRoles();
  const [status, setStatus] = useState<StatusFilter>(ALL);
  const [tier, setTier] = useState<string>(ALL);
  const [country, setCountry] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const all = useMemo(() => rows ?? [], [rows]);
  const tierOptions: SelectOption<string>[] = [{ value: ALL, label: "All tiers" }, ...AMBASSADOR_TIERS.map((value) => ({ value, label: AMBASSADOR_TIER_LABELS[value] }))];
  const countryOptions: SelectOption<string>[] = useMemo(
    () => [{ value: ALL, label: "All countries" }, ...[...new Set(all.map((row) => row.country))].sort().map((name) => ({ value: name, label: name }))],
    [all],
  );

  // Tier, Country and the search first; the status tabs and their counts then work on what is left.
  const term = search.trim().toLowerCase();
  const scoped = all.filter(
    (row) =>
      (tier === ALL || row.tier === (tier as AmbassadorTier)) &&
      (country === ALL || row.country === country) &&
      (!term || row.name.toLowerCase().includes(term) || row.campus.toLowerCase().includes(term)),
  );
  const visible = status === ALL ? scoped : scoped.filter((row) => row.status === status);
  const options = [
    { value: ALL as StatusFilter, label: "All", count: rows ? scoped.length : undefined },
    ...AMBASSADOR_STATUSES.map((value) => ({
      value: value as StatusFilter,
      label: getStatusMeta(value).label,
      count: rows ? scoped.filter((row) => row.status === value).length : undefined,
    })),
  ];
  const filtered = status !== ALL || tier !== ALL || country !== ALL || term !== "";

  return (
    <ListPage
      title="Network"
      subtitle="Ambassadors who amplify listings with their referral code."
      action={can("network", "edit") ? { label: "New ambassador", href: "/network/new", icon: Plus } : undefined}
      toolbar={
        <div className="space-y-4">
          <NotConnectedNotice />
          <NetworkSummary ambassadors={rows} logs={logs} />
          <TableToolbar
            search={{ value: search, onChange: setSearch, placeholder: "Search by name or campus", label: "Search ambassadors" }}
            filters={{ options, value: status, onChange: setStatus, label: "Filter by status" }}
          >
            <Select options={tierOptions} value={tier} onChange={setTier} ariaLabel="Filter by tier" sheetTitle="Tier" className="w-fit" />
            <Select options={countryOptions} value={country} onChange={setCountry} ariaLabel="Filter by country" sheetTitle="Country" className="w-fit" />
          </TableToolbar>
        </div>
      }
    >
      <DataTable
        label="Ambassadors"
        columns={COLUMNS}
        rows={visible}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/network/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        isFiltered={filtered}
        resetKey={`${status}|${tier}|${country}|${term}`}
        emptyNoData={{ icon: NetworkIcon, title: "No ambassadors yet", description: "People who share listings with their referral code appear here." }}
        emptyNoResults={{ icon: NetworkIcon, title: "No ambassadors match these filters", description: "Try another status, tier, country or search." }}
      />
    </ListPage>
  );
}
