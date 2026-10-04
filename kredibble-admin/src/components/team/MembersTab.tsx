"use client";

/**
 * Team > Members: admin and support accounts, on the shared list template (DataTable).
 * Data: the in-memory staff store (src/lib/mock-staff.ts). It is live: inviting a member or changing a
 * role elsewhere updates this list through the store's subscription. Row links open /staff/[id].
 */
import { UserCog } from "lucide-react";
import { staffStore, type StaffMember } from "@/lib/mock-staff";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import type { Column } from "@/components/list/types";

// Module-level so they are stable references for the hook.
const loadStaff = () => Promise.resolve([...staffStore.members]);
const subscribeToStaff = (notify: () => void) => staffStore.subscribe(notify);

const COLUMNS: Column<StaffMember>[] = [
  { key: "name", header: "Name", type: "primary", width: "27%", title: (r) => r.name },
  { key: "email", header: "Email", type: "text", width: "30%", value: (r) => r.email },
  { key: "role", header: "Role", type: "pill", width: "20%", label: (r) => r.role },
  { key: "status", header: "Status", type: "status", width: "23%", status: (r) => r.status },
];

export function MembersTab() {
  const { rows, isLoading, error, retry } = useListData(loadStaff, { subscribe: subscribeToStaff });

  return (
    <DataTable
      label="Staff"
      columns={COLUMNS}
      rows={rows ?? []}
      getRowKey={(r) => r.id}
      getRowHref={(r) => `/staff/${r.id}`}
      loading={isLoading}
      error={error}
      onRetry={retry}
      emptyNoData={{ icon: UserCog, title: "No staff accounts yet", description: "Invite the first admin or support member." }}
      emptyNoResults={{ icon: UserCog, title: "No staff match" }}
    />
  );
}
