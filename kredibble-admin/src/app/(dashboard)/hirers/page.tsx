"use client";

/**
 * Hirers Directory: every hirer / company account, with text search.
 * Built on the shared list template; this file holds the column config, the search and the data.
 * Data: mock hirer accounts (src/lib/mock-hirers.ts), unchanged.
 */
import { useState } from "react";
import { Building2 } from "lucide-react";
import { hirerAccounts, type HirerAccount } from "@/lib/mock-hirers";
import { overlayRows, subscribeMockStore } from "@/lib/mock-store";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";

// Mock records with this session's changes (see mock-store.ts) laid over them.
const loadHirers = () => Promise.resolve(overlayRows("hirers", hirerAccounts));

const COLUMNS: Column<HirerAccount>[] = [
  { key: "company", header: "Company", type: "primary", width: "22%", title: (r) => r.companyName, subtitle: (r) => r.location },
  { key: "recruiter", header: "Recruiter", type: "text", width: "17%", value: (r) => r.recruiterName },
  { key: "industry", header: "Industry", type: "text", width: "15%", value: (r) => r.industry },
  { key: "postings", header: "Postings", type: "number", width: "10%", value: (r) => r.postingsCount },
  { key: "verification", header: "Verification", type: "status", width: "18%", status: (r) => r.verification },
  { key: "status", header: "Status", type: "status", width: "18%", status: (r) => r.status },
];

export default function HirersDirectoryPage() {
  const { rows, isLoading, error, retry } = useListData(loadHirers, { subscribe: subscribeMockStore });
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = (rows ?? []).filter((h) =>
    `${h.companyName} ${h.recruiterName} ${h.recruiterEmail} ${h.industry}`.toLowerCase().includes(q),
  );

  return (
    <ListPage
      title="Hirers Directory"
      subtitle={rows ? `${rows.length} hirer/company accounts registered on the platform.` : "Hirer/company accounts registered on the platform."}
      toolbar={
        <TableToolbar
          search={{ value: query, onChange: setQuery, placeholder: "Search by company, recruiter, industry...", label: "Search hirers" }}
        />
      }
    >
      <DataTable
        label="Hirers"
        columns={COLUMNS}
        rows={visible}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/hirers/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        isFiltered={q !== ""}
        resetKey={q}
        emptyNoData={{ icon: Building2, title: "No hirer accounts yet", description: "Companies appear here once they register." }}
        emptyNoResults={{ icon: Building2, title: "No hirers match your search", description: "Check the spelling, or try a company, recruiter or industry." }}
      />
    </ListPage>
  );
}
