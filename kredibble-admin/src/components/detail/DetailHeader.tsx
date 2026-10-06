/**
 * DetailHeader: the card at the top of every detail page.
 *
 *   [ 56px avatar or icon tile ]  Title (Jakarta 24/30)  [status badges]        [ actions ]
 *                                 muted line (email, company, date...)
 *
 * On screens narrower than 640px the actions move BELOW the title block.
 * The title is the page's one h1. Badges are StatusBadge components (the same
 * ones the list pages use, mapped by src/lib/status-map.ts).
 *
 * Props:
 * - leading: { name } for a 56px initials avatar (people, companies), or { icon, tone? } for a 56px icon tile
 *   (tone "brand" = the orange entity tile)
 * - eyebrow: optional small node above the title (a type pill, for example)
 * - title: the h1 text
 * - badges: StatusBadge nodes shown beside the title
 * - meta: the muted line under the title
 * - actions: non-destructive decisions (Approve, Resolve, Reinstate...). Destructive ones go in the
 *   DangerZone card instead.
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";

interface DetailHeaderProps {
  leading: { name: string } | { icon: LucideIcon; /** "brand" = the orange entity tile (Programs). Default: purple. */ tone?: "accent" | "brand" };
  eyebrow?: ReactNode;
  title: string;
  badges?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function DetailHeader({ leading, eyebrow, title, badges, meta, actions }: DetailHeaderProps) {
  return (
    <Card as="section" ariaLabel="Summary" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        {"name" in leading ? <Avatar name={leading.name} size="lg" /> : <IconTile icon={leading.icon} tone={leading.tone ?? "accent"} size="lg" />}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1">{eyebrow}</div>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 data-testid="page-title" className="page-title break-words">{title}</h1>
            {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
          </div>
          {meta && <p className="page-subtitle mt-1 break-words">{meta}</p>}
        </div>
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </Card>
  );
}
