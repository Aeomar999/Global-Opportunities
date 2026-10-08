"use client";

/**
 * ReportPage: one Monthly report template (view "partner" or "team") with its controls.
 *
 * Everything the reader operates sits OUTSIDE the paper and is hidden in print: the title block, the sample-data notice, the two tabs (plain links to
 * /monthly-report/partner and /monthly-report/team; the Team tab is not rendered for a role that cannot view it), the month selector and "Download PDF".
 * Only the paper prints.
 *
 * DOWNLOAD PDF (an orange primary button, no dependency): records one report in the store BEFORE it calls window.print(), at most once per reportMonth and
 * view in each calendar month, so the Monthly reports KPI counts it. THE BUTTON COUNTS AS "GENERATED": there is no separate file step. The first time it
 * shows a toast ("Report recorded for September 2026"); later clicks only print. Its tooltip says "Choose Save as PDF in the print dialog".
 *
 * TITLE WHILE PRINTING: document.title becomes "GOD-Progress-Report-2026-09" (partner) or "GOD-Team-Report-2026-09" (team) on `beforeprint` and is put back on
 * `afterprint`. Using the events (not the button) also covers Ctrl+P, and the print dialog proposes that as the file name.
 *
 * Props: view
 */
import { useCallback, useEffect } from "react";
import { CalendarRange, Printer } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { Button } from "@/components/ui/Button";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select, type SelectOption } from "@/components/ui/form/Select";
import { StatusBanner } from "@/components/overview/StatusBanner";
import { Tabs } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { formatMonth } from "@/lib/format";
import { useMockStoreVersion } from "@/lib/mock-store";
import { lastCompleteMonth, reportTitle, type ReportView } from "@/lib/report";
import { getPartnerReport, getTeamReport, recordReport } from "@/lib/services/report";
import { useAsync } from "@/lib/use-async";
import { useReportMonth } from "@/lib/use-report-month";
import { PartnerReport } from "./PartnerReport";
import { TeamReport } from "./TeamReport";

type TabValue = "partner" | "team";

export function ReportPage({ view }: { view: ReportView }) {
  const { can } = useRoles();
  const toast = useToast();
  const { month, setMonth, options, toDate } = useReportMonth();
  const version = useMockStoreVersion();

  // A new function (so the report loads again) when the month or the store changes; the data stays until the new one arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadPartner = useCallback(() => getPartnerReport(month), [month, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadTeam = useCallback(() => getTeamReport(month), [month, version]);
  const partner = useAsync(view === "partner" ? loadPartner : loadNothing);
  const team = useAsync(view === "team" ? loadTeam : loadNothing);
  const active = view === "partner" ? partner : team;
  const loading = active.isLoading;
  const issue = view === "partner" ? partner.data?.issue : team.data?.issue;

  // The title of the printed page (and the proposed file name): set before printing, put back after. The events cover Ctrl+P too.
  useEffect(() => {
    let original: string | null = null;
    const before = () => {
      original = document.title;
      document.title = reportTitle(view, month);
    };
    const after = () => {
      if (original !== null) document.title = original;
      original = null;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [view, month]);

  const download = () => {
    // The button counts as "generated": record the report first (once per month and view), then print.
    if (recordReport(month, view)) toast.success(`Report recorded for ${formatMonth(month)}`);
    window.print();
  };

  const monthOptions: SelectOption<string>[] = options.map((value, index) => ({ value, label: formatMonth(value), badge: index === 0 ? "Month to date" : undefined }));
  // the tabs keep the chosen month
  const query = month === lastCompleteMonth() ? "" : `?month=${month}`;
  const links: Record<TabValue, string> = { partner: `/monthly-report/partner${query}`, team: `/monthly-report/team${query}` };
  const tabs = [{ value: "partner" as const, label: "Partner report" }, ...(can("team_scorecard", "view") ? [{ value: "team" as const, label: "Team report" }] : [])];

  return (
    <div className="space-y-4">
      <div data-print-hide className="space-y-4">
        <PageHeader
          title="Monthly report"
          subtitle="The desk's month in numbers, ready to print or save as a PDF."
          icon={CalendarRange}
          tone="neutral"
          actions={
            <div className="flex flex-col items-start gap-1 min-[640px]:items-end">
            <div className="flex flex-wrap items-center gap-3">
              <Select className="w-fit" ariaLabel="Month" sheetTitle="Select month" icon={CalendarRange} options={monthOptions} value={month} onChange={setMonth} />
              <Tooltip label="Choose Save as PDF in the print dialog">
                <Button type="button" variant="primary" icon={Printer} onClick={download} disabled={loading || !!issue} data-testid="download-pdf">
                  Download PDF
                </Button>
              </Tooltip>
            </div>
            <p data-testid="download-hint" className="caption">
              In the print dialog choose A4 and untick Headers and footers.
            </p>
            </div>
          }
        />
        <NotConnectedNotice />
        <Tabs ariaLabel="Report templates" idPrefix="report" value={view} onChange={() => undefined} tabs={tabs} links={links} />
        {toDate && (
          <p data-testid="to-date-note" className="caption">
            Month to date: the figures are for the days so far and are compared with the same period last month, estimated. Past months are read-only.
          </p>
        )}
        {issue && !loading && <StatusBanner issue={issue} onRetry={active.reload} />}
      </div>
      {view === "partner" ? <PartnerReport data={partner.data?.data ?? null} month={month} toDate={toDate} /> : <TeamReport data={team.data?.data ?? null} month={month} toDate={toDate} />}
    </div>
  );
}

/** For the template that is not shown: nothing to load. */
const loadNothing = () => new Promise<never>(() => {});
