"use client";

/**
 * Ambassador applications: seekers and hirers who asked, in the mobile app, to become ambassadors.
 * Built on the shared list template (ListPage + TableToolbar + DataTable), like the Verification Queue.
 *
 * Data: GET /admin/ambassador-requests (real API; there is no mock version). It loads the first 100 once and the
 * status filter and its counts are computed here. A failed request shows inline with "Try again".
 * Each row opens /ambassador-applications/[id], where the request is approved or rejected.
 */
import { useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { getAmbassadorRequests, type AmbassadorRequestRecord } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";

type Filter = "all" | "pending" | "approved" | "rejected";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const loadRequests = async (): Promise<AmbassadorRequestRecord[]> => (await getAmbassadorRequests({ limit: 100 })).data;

const COLUMNS: Column<AmbassadorRequestRecord>[] = [
  { key: "applicant", header: "Applicant", type: "primary", width: "32%", title: (r) => r.name, subtitle: (r) => r.email, leading: (r) => ({ avatarName: r.name }) },
  { key: "role", header: "Applying as", type: "pill", width: "14%", label: (r) => (r.role === "hirer" ? "Hirer" : "Seeker") },
  { key: "background", header: "Profession / organisation", type: "text", width: "24%", value: (r) => [r.profession, r.organisation].filter(Boolean).join(" · ") || "—" },
  { key: "submitted", header: "Applied", type: "text", width: "14%", value: (r) => formatDate(r.createdAt) },
  { key: "status", header: "Status", type: "status", width: "16%", status: (r) => r.status },
];

export default function AmbassadorApplicationsPage() {
  const { rows, isLoading, error, retry } = useListData(loadRequests);
  const [filter, setFilter] = useState<Filter>("pending");

  const all = useMemo(() => rows ?? [], [rows]);
  const options = FILTERS.map((f) => ({
    ...f,
    count: rows ? (f.value === "all" ? all.length : all.filter((r) => r.status === f.value).length) : undefined,
  }));
  const visible = filter === "all" ? all : all.filter((r) => r.status === filter);

  return (
    <ListPage
      title="Ambassador applications"
      subtitle="Review the people who asked to become Kredibble ambassadors. Approving adds them to the ambassador registry and, if you choose, a channel."
      toolbar={<TableToolbar filters={{ options, value: filter, onChange: setFilter, label: "Filter by status" }} />}
    >
      <DataTable
        label="Ambassador applications"
        columns={COLUMNS}
        rows={visible}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/ambassador-applications/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        isFiltered={filter !== "all"}
        resetKey={filter}
        emptyNoData={{ icon: Megaphone, title: "No applications yet", description: "They appear here when someone taps “Become an ambassador” in the app." }}
        emptyNoResults={{ icon: Megaphone, title: "No applications match this filter", description: "Try another status, or choose All." }}
      />
    </ListPage>
  );
}
