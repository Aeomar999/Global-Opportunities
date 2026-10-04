"use client";

/**
 * Verification Queue: companies that submitted their documents for Hirer verification.
 * Built on the shared list template (ListPage + TableToolbar + DataTable): this file only
 * holds the column config, the filter and the data loader.
 *
 * Data: loadVerificationRows() (mock data in mock mode, GET /verification/companies in real mode).
 * It loads everything once; the filter and its counts are computed here, so changing the filter
 * does not make a request. A failed request shows inline with "Try again".
 */
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { loadVerificationRows, type VerificationRow } from "@/lib/services/lists";
import { subscribeMockStore } from "@/lib/mock-store";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";

type Filter = "all" | "pending" | "approved" | "rejected";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const COLUMNS: Column<VerificationRow>[] = [
  { key: "company", header: "Company", type: "primary", width: "34%", title: (r) => r.name, subtitle: (r) => r.recruiterEmail },
  { key: "industry", header: "Industry", type: "text", width: "22%", value: (r) => r.industry },
  { key: "submitted", header: "Submitted", type: "text", width: "20%", value: (r) => formatDate(r.submittedDate) },
  { key: "status", header: "Status", type: "status", width: "24%", status: (r) => r.overallStatus },
];

export default function VerificationQueuePage() {
  const { rows, isLoading, error, retry } = useListData(loadVerificationRows, { subscribe: subscribeMockStore });
  const [filter, setFilter] = useState<Filter>("all");

  const all = useMemo(() => rows ?? [], [rows]);
  const options = FILTERS.map((f) => ({
    ...f,
    count: rows ? (f.value === "all" ? all.length : all.filter((r) => r.overallStatus === f.value).length) : undefined,
  }));
  const visible = filter === "all" ? all : all.filter((r) => r.overallStatus === filter);

  return (
    <ListPage
      title="Verification Queue"
      subtitle="Review the documents companies submitted at signup and approve or reject their Hirer verification."
      toolbar={<TableToolbar filters={{ options, value: filter, onChange: setFilter, label: "Filter by status" }} />}
    >
      <DataTable
        label="Verification requests"
        columns={COLUMNS}
        rows={visible}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/verification/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        isFiltered={filter !== "all"}
        resetKey={filter}
        emptyNoData={{ icon: ShieldCheck, title: "No verification requests yet", description: "Companies show up here when they submit their documents at signup." }}
        emptyNoResults={{ icon: ShieldCheck, title: "No requests match this filter", description: "Try another status, or choose All." }}
      />
    </ListPage>
  );
}
