"use client";

/**
 * Team > Members: everyone on the team, on the shared list template (DataTable).
 * Data: the ONE staff collection (services/staff.ts), the same people the invite form, the member page and the
 * scorecards use. It is live: inviting a member or changing a role elsewhere updates this list through the store's
 * subscription. The Role column shows a pill for EVERY role a person holds. Row links open /staff/[id].
 * All members fit on one page (25 rows), so the number of rows is the number of people.
 */
import { UserCog } from "lucide-react";
import { ROLES } from "@/config/roles";
import type { StaffMember } from "@/lib/mock-entities";
import { loadStaffRows, subscribeStaff } from "@/lib/services/staff";
import { useListData } from "@/lib/use-list-data";
import { DataTable } from "@/components/list/DataTable";
import type { Column } from "@/components/list/types";

const COLUMNS: Column<StaffMember>[] = [
  { key: "name", header: "Name", type: "primary", width: "26%", title: (r) => r.name, subtitle: (r) => r.title },
  { key: "email", header: "Email", type: "text", width: "26%", value: (r) => r.email },
  { key: "role", header: "Role", type: "pill", width: "30%", mobileLabel: "Roles", label: (r) => r.roles.map((role) => ROLES[role].label) },
  { key: "status", header: "Status", type: "status", width: "18%", status: (r) => r.status },
];

export function MembersTab() {
  const { rows, isLoading, error, retry } = useListData(loadStaffRows, { subscribe: subscribeStaff });

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
      pageSize={25}
      emptyNoData={{ icon: UserCog, title: "No staff accounts yet", description: "Invite the first admin or support member." }}
      emptyNoResults={{ icon: UserCog, title: "No staff match" }}
    />
  );
}
