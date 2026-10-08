"use client";

/**
 * Scorecard (/scorecard): ONE shared component (components/scorecard/Scorecard.tsx) in two modes.
 *
 * Tabs: "My scorecard" for every role and "Team" for the roles that can view the team scorecard (desk lead and super admin, screen
 * team_scorecard). The tab is kept in the URL (/scorecard?tab=team); a person without access to it stays on "My scorecard": the Team tab
 * is not rendered, the direct URL falls back to My scorecard, and the team data is never even loaded.
 *
 * "Me" is the viewer's CURRENT roles from the role context (so the dev role switcher works), with the current user's name. A ?user=
 * parameter is ignored: nothing on this page reads it.
 *
 * The month is the header's selector (?month=YYYY-MM, default this month); a past month is a read-only snapshot.
 * Real-API mode: the sample-data notice and a calm "Not available yet". Dev only: ?state=loading|error|empty (mock mode).
 */
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Target } from "lucide-react";
import { RequireAccess } from "@/components/access/RequireAccess";
import { useRoles } from "@/components/access/RoleProvider";
import { StatusBanner } from "@/components/overview/StatusBanner";
import { Scorecard } from "@/components/scorecard/Scorecard";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, tabId, tabPanelId } from "@/components/ui/Tabs";
import { useMockStoreVersion } from "@/lib/mock-store";
import { getMyScorecard, getTeamScorecard, type ScorecardResult } from "@/lib/services/scorecard";
import { useAsync } from "@/lib/use-async";
import { useMonth } from "@/lib/use-month";
import type { MonthKey } from "@/lib/mock-entities";
import type { Role } from "@/config/roles";

type ScorecardTab = "mine" | "team";
const ID_PREFIX = "scorecard";

/** Loads one scorecard and renders it (its own hook, so the team data is only requested while the Team tab is open). */
function Panel({ scope, month, load }: { scope: "me" | "team"; month: MonthKey; load: () => Promise<ScorecardResult> }) {
  const result = useAsync(load);
  const data = result.data?.data ?? null;
  const issue = result.data?.issue ?? (result.error ? { kind: "failed" as const, message: result.error.message } : null);
  return (
    <div className="space-y-4">
      <NotConnectedNotice />
      {issue && !result.isLoading && <StatusBanner issue={issue} onRetry={result.reload} />}
      <Scorecard scope={scope} month={month} people={data?.people ?? []} series={data?.series ?? null} loading={result.isLoading} notConnected={data?.notConnected ?? false} tooEarly={data?.tooEarly ?? false} isPast={data?.isPast ?? false} />
    </div>
  );
}

function MyPanel({ roles, month }: { roles: Role[]; month: MonthKey }) {
  const version = useMockStoreVersion();
  const key = roles.join(",");
  // A new function (so the data loads again) when the roles, the month or the store change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => getMyScorecard(key ? (key.split(",") as Role[]) : [], month), [key, month, version]);
  return <Panel scope="me" month={month} load={load} />;
}

function TeamPanel({ month }: { month: MonthKey }) {
  const version = useMockStoreVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => getTeamScorecard(month), [month, version]);
  return <Panel scope="team" month={month} load={load} />;
}

export default function ScorecardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { can, roles } = useRoles();
  const { month } = useMonth();
  const canSeeTeam = can("team_scorecard", "view");
  const params = useSearchParams();
  const tab: ScorecardTab = canSeeTeam && params.get("tab") === "team" ? "team" : "mine";
  const select = (next: ScorecardTab) => {
    const query = new URLSearchParams(params.toString());
    if (next === "mine") query.delete("tab");
    else query.set("tab", next);
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };

  return (
    <RequireAccess screen="my_scorecard">
      <div className="space-y-4">
        <PageHeader title="Scorecard" subtitle="Targets and results." icon={Target} tone="neutral" actions={<MonthSelect />} />
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
          {tab === "team" ? <TeamPanel month={month} /> : <MyPanel roles={roles} month={month} />}
        </div>
      </div>
    </RequireAccess>
  );
}
