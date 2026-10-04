"use client";

/**
 * Seekers Directory: every seeker account, with text search.
 * Built on the shared list template; this file holds the column config, the search and the data.
 * Data: mock seeker accounts (src/lib/mock-seekers.ts), unchanged.
 */
import { useState } from "react";
import { Users } from "lucide-react";
import type { SeekerAccount } from "@/lib/mock-seekers";
import { subscribeMockStore } from "@/lib/mock-store";
import { loadSeekerRows } from "@/lib/services/directory";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import { ListPage } from "@/components/list/ListPage";
import { TableToolbar } from "@/components/list/TableToolbar";
import type { Column } from "@/components/list/types";

// Mock mode: the mock records with this session's changes laid over them; real mode: the admin API (services/directory.ts).
const loadSeekers = loadSeekerRows;

const COLUMNS: Column<SeekerAccount>[] = [
  { key: "name", header: "Name", type: "primary", width: "26%", title: (r) => r.name, subtitle: (r) => r.email },
  { key: "university", header: "University", type: "text", width: "24%", value: (r) => r.university },
  { key: "country", header: "Country", type: "text", width: "14%", value: (r) => r.country },
  { key: "applied", header: "Applied", type: "number", width: "10%", value: (r) => r.applicationsCount },
  { key: "saved", header: "Saved", type: "number", width: "10%", value: (r) => r.savedCount },
  { key: "status", header: "Status", type: "status", width: "16%", status: (r) => r.status },
];

export default function SeekersDirectoryPage() {
  const { rows, isLoading, error, retry } = useListData(loadSeekers, { subscribe: subscribeMockStore });
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = (rows ?? []).filter((s) => `${s.name} ${s.email} ${s.university} ${s.country}`.toLowerCase().includes(q));

  return (
    <ListPage
      title="Seekers Directory"
      subtitle={rows ? `${rows.length} seeker accounts registered on the platform.` : "Seeker accounts registered on the platform."}
      toolbar={
        <TableToolbar
          search={{ value: query, onChange: setQuery, placeholder: "Search by name, email, university...", label: "Search seekers" }}
        />
      }
    >
      <DataTable
        label="Seekers"
        columns={COLUMNS}
        rows={visible}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/seekers/${r.id}`}
        loading={isLoading}
        error={error}
        onRetry={retry}
        isFiltered={q !== ""}
        resetKey={q}
        emptyNoData={{ icon: Users, title: "No seeker accounts yet", description: "Seekers appear here once they register." }}
        emptyNoResults={{ icon: Users, title: "No seekers match your search", description: "Check the spelling, or try a name, email, university or country." }}
      />
    </ListPage>
  );
}
