/**
 * Monthly report (/monthly-report): sends the reader to the Partner report (/monthly-report/partner), keeping the chosen ?month=. The two templates are
 * separate routes: /monthly-report/partner and /monthly-report/team.
 */
import { redirect } from "next/navigation";

export default async function MonthlyReportIndex({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  redirect(`/monthly-report/partner${month ? `?month=${encodeURIComponent(month)}` : ""}`);
}
