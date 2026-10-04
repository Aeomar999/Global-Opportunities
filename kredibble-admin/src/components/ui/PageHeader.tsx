/**
 * PageHeader: the title block at the top of a page (an optional entity icon tile, the h1, a muted line and an
 * optional action on the right). Same type scale as the list pages' header (page-title / page-subtitle).
 *
 * Props:
 * - title: the page's h1
 * - subtitle: one muted line
 * - icon / tone: an optional IconTile before the title. Entities keep their accent: orange ("brand") for
 *   Opportunities and Programs, purple ("accent") for Partners and Network; the rest use neutral or none.
 * - actions: optional node on the right (a primary button, for example)
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconTile, type Tone } from "./IconTile";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, icon, tone = "accent", actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <IconTile icon={icon} tone={tone} size="md" />}
        <div className="min-w-0">
          <h1 data-testid="page-title" className="page-title break-words">
            {title}
          </h1>
          {subtitle && <p className="page-subtitle mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </header>
  );
}
