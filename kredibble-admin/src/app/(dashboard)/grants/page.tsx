"use client";

/**
 * Grants: funding-pool allocation and application review across all posted grants.
 * Built on the shared list template; this file holds the column config and the data.
 * Data: mock grants (src/lib/mock-grant-ops.ts), unchanged.
 */
import { HandCoins } from "lucide-react";
import { grantRecords, type GrantRecord } from "@/lib/mock-grant-ops";
import { overlayRows, subscribeMockStore } from "@/lib/mock-store";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import type { Column } from "@/components/list/types";

// Mock records with this session's changes (see mock-store.ts) laid over them.
const loadGrants = () => Promise.resolve(overlayRows("grants", grantRecords));

const COLUMNS: Column<GrantRecord>[] = [
  { key: "grant", header: "Grant", type: "primary", width: "27%", title: (r) => r.title, leading: () => ({ icon: HandCoins }) },
  { key: "hirer", header: "Hirer", type: "text", width: "15%", value: (r) => r.hirer },
  { key: "sector", header: "Sector", type: "text", width: "13%", value: (r) => r.sector },
  {
    key: "budget",
    header: "Budget allocated",
    type: "progress",
    width: "28%",
    label: (r) => `$${r.allocated.toLocaleString()} / $${r.fundingPool.toLocaleString()}`,
    percent: (r) => Math.round((r.allocated / r.fundingPool) * 100),
  },
  { key: "status", header: "Status", type: "status", width: "17%", status: (r) => r.status },
];

export default function GrantsOpsPage() {
  const { rows, isLoading, error, retry } = useListData(loadGrants, { subscribe: subscribeMockStore });

  return (
    <ListPage title="Grants" subtitle="Funding pool allocation and application review across all posted grants.">
      <DataTable
        label="Grants"
        columns={COLUMNS}
        rows={rows ?? []}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/grants/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        emptyNoData={{ icon: HandCoins, title: "No grants yet", description: "Grants posted by hirers appear here." }}
        emptyNoResults={{ icon: HandCoins, title: "No grants match" }}
      />
    </ListPage>
  );
}
