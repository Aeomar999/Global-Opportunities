"use client";

/**
 * OverviewHeader: a time-of-day greeting with the person's first name, a short
 * subtitle, the month selector and the orange primary "View report" button. "View report" opens the Partner report of the SELECTED month
 * (/monthly-report/partner?month=...) and is not rendered for a role that cannot view the Monthly report.
 *
 * Greeting: "Good morning, Ama." before 12:00, "Good afternoon" before 18:00,
 * otherwise "Good evening". It uses the first word of the signed-in user's
 * name and drops the name if there is none. The page only renders after the
 * shell has mounted in the browser, so reading the clock and localStorage here
 * cannot cause a hydration mismatch.
 *
 * Stacks vertically below 1024px.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAdminUser } from "@/lib/api";
import { buttonClasses } from "@/components/ui/Button";
import { useRoles } from "@/components/access/RoleProvider";
import { MonthSelect } from "@/components/ui/MonthSelect";
import { useMonth } from "@/lib/use-month";

const greetingFor = (hour: number) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

export function OverviewHeader() {
  const { can } = useRoles();
  const { month } = useMonth();
  const [greeting] = useState(() => {
    const firstName = getAdminUser()?.name?.trim().split(/\s+/)[0];
    return `${greetingFor(new Date().getHours())}${firstName ? `, ${firstName}` : ""}.`;
  });

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 data-testid="page-title" className="hero-title">{greeting}</h1>
        <p className="page-subtitle mt-1">Here&apos;s what&apos;s happening across your platform today.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <MonthSelect />

        {can("monthly_report", "view") && (
          <Link href={`/monthly-report/partner?month=${month}`} className={buttonClasses("primary")}>
            View report
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
          </Link>
        )}
      </div>
    </header>
  );
}
