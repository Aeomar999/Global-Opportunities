"use client";

/**
 * Scorecard (/scorecard): placeholder, built in a later step.
 * Tabs: "My scorecard" for every role and "Team" for the roles that can view the team scorecard (desk lead and
 * super admin). The tab is kept in the URL (/scorecard?tab=team); a person without access to it stays on
 * "My scorecard".
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Target, Hammer } from "lucide-react";
import { RequireAccess } from "@/components/access/RequireAccess";
import { useRoles } from "@/components/access/RoleProvider";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, tabId, tabPanelId } from "@/components/ui/Tabs";

type ScorecardTab = "mine" | "team";
const ID_PREFIX = "scorecard";

export default function ScorecardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useRoles();
  const canSeeTeam = can("team_scorecard", "view");
  const requested = useSearchParams().get("tab");
  const tab: ScorecardTab = canSeeTeam && requested === "team" ? "team" : "mine";
  const select = (next: ScorecardTab) => router.replace(next === "mine" ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  return (
    <RequireAccess screen="my_scorecard">
      <div className="space-y-4">
        <PageHeader title="Scorecard" subtitle="Targets and results for you and, for the desk lead, the team." icon={Target} tone="neutral" />
        {canSeeTeam && (
          <Tabs
            ariaLabel="Scorecard sections"
            idPrefix={ID_PREFIX}
            value={tab}
            onChange={select}
            tabs={[
              { value: "mine", label: "My scorecard" },
              { value: "team", label: "Team" },
            ]}
          />
        )}
        <div role={canSeeTeam ? "tabpanel" : undefined} id={tabPanelId(ID_PREFIX, tab)} aria-labelledby={canSeeTeam ? tabId(ID_PREFIX, tab) : undefined}>
          <Card as="section" ariaLabel={tab === "team" ? "Team scorecard" : "My scorecard"}>
            <EmptyState icon={Hammer} title="This screen is built in a later step" description={tab === "team" ? "The team scorecard." : "Your personal scorecard."} />
          </Card>
        </div>
      </div>
    </RequireAccess>
  );
}
