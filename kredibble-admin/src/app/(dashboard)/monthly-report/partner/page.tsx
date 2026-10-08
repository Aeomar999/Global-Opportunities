"use client";

/**
 * Partner report (/monthly-report/partner): the report prepared for partners (aggregate figures only). Needs monthly_report view (see config/permissions.ts).
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { ReportPage } from "@/components/report/ReportPage";

export default function PartnerReportPage() {
  return (
    <RequireAccess screen="monthly_report">
      <ReportPage view="partner" />
    </RequireAccess>
  );
}
