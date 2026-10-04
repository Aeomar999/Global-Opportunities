"use client";

/**
 * Team: this one page replaces Staff and Roles & Permissions (their old URLs redirect here: see
 * src/config/redirects.ts). The tab is kept in the URL: /team (Members) and /team?tab=roles.
 *
 * - Members: the staff list on the shared list template, with "Invite Staff" (opens /staff/invite).
 *   A member's row opens /staff/[id]; both stay real routes under Team.
 * - Roles & permissions: three role cards with switches and a sticky save bar.
 * Both panels stay mounted (the inactive one is hidden), so unsaved permission edits survive a switch to Members.
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { MembersTab } from "@/components/team/MembersTab";
import { RolesTab } from "@/components/team/RolesTab";
import { buttonClasses } from "@/components/ui/Button";
import { Tabs, tabId, tabPanelId } from "@/components/ui/Tabs";

type TeamTab = "members" | "roles";
const ID_PREFIX = "team";

export default function TeamPage() {
  const router = useRouter();
  const pathname = usePathname();
  const tab: TeamTab = useSearchParams().get("tab") === "roles" ? "roles" : "members";

  const select = (next: TeamTab) => router.replace(next === "members" ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 data-testid="page-title" className="page-title">Team</h1>
          <p className="page-subtitle mt-1">Admin and support accounts, and what each role can do.</p>
        </div>
        {tab === "members" && (
          <Link href="/staff/invite" className={buttonClasses("primary")}>
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            Invite Staff
          </Link>
        )}
      </header>

      <Tabs
        ariaLabel="Team sections"
        idPrefix={ID_PREFIX}
        value={tab}
        onChange={select}
        tabs={[
          { value: "members", label: "Members" },
          { value: "roles", label: "Roles & permissions" },
        ]}
      />

      <div role="tabpanel" id={tabPanelId(ID_PREFIX, "members")} aria-labelledby={tabId(ID_PREFIX, "members")} hidden={tab !== "members"}>
        <MembersTab />
      </div>
      <div role="tabpanel" id={tabPanelId(ID_PREFIX, "roles")} aria-labelledby={tabId(ID_PREFIX, "roles")} hidden={tab !== "roles"} className="flex-1 [&:not([hidden])]:flex [&:not([hidden])]:flex-col">
        <RolesTab />
      </div>
    </div>
  );
}
