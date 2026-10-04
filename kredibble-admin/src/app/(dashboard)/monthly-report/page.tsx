"use client";

/**
 * Monthly report (/monthly-report): placeholder, built in a later step. It is already in the nav and guarded by the
 * "monthly_report" screen (src/config/permissions.ts).
 */
import { CalendarRange } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function MonthlyreportPage() {
  return <StubPage screen="monthly_report" title="Monthly report" subtitle="The desk's month in numbers." icon={CalendarRange} tone="neutral" />;
}
