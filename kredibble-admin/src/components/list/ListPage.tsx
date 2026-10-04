/**
 * ListPage: the page frame shared by every list page.
 *
 *   header   title and subtitle on the left, an optional primary action on the right
 *   toolbar  (16px below) search / filters, passed in as <TableToolbar />
 *   content  (16px below) the table card, passed in as <DataTable />
 *
 * Pages hand it a title, subtitle, optional action and their toolbar + table.
 * They never write page chrome themselves, so every list has the same spacing:
 * one h1 per page, 16px between blocks.
 *
 * Props:
 * - title: the h1 (Jakarta 700 24/30; 22/28 below 640px)
 * - subtitle: one muted line, including the live-count text ("5 seeker accounts registered...")
 * - action: optional { label, href, icon } rendered as the orange primary button
 * - toolbar: optional node (usually <TableToolbar />)
 * - children: the table
 */
import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

interface ListPageProps {
  title: string;
  subtitle: string;
  action?: { label: string; href: string; icon?: LucideIcon };
  toolbar?: ReactNode;
  children: ReactNode;
}

export function ListPage({ title, subtitle, action, toolbar, children }: ListPageProps) {
  const ActionIcon = action?.icon;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 data-testid="page-title" className="page-title">{title}</h1>
          <p className="page-subtitle mt-1">{subtitle}</p>
        </div>
        {action && (
          <Link href={action.href} className={buttonClasses("primary")}>
            {ActionIcon && <ActionIcon size={16} strokeWidth={2} aria-hidden="true" />}
            {action.label}
          </Link>
        )}
      </header>

      {toolbar}
      {children}
    </div>
  );
}
