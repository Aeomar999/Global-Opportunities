"use client";

/**
 * Team report (/monthly-report/team): the internal report. Needs team_scorecard view (Desk Lead and Super Admin); any other role gets the no-access state on a
 * direct URL, and the tab is not rendered for them.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { ReportPage } from "@/components/report/ReportPage";

export default function TeamReportPage() {
  return (
    <RequireAccess screen="team_scorecard">
      <ReportPage view="team" />
    </RequireAccess>
  );
}
