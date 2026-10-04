/**
 * EmptyState: shown when a data block has loaded but has nothing to show.
 * Also used for error states (pass tone="danger" and a retry action).
 *
 * Props:
 * - icon: lucide icon
 * - title / description: short copy (title Jakarta 16/22, description 14/20 muted)
 * - tone: "neutral" (purple tile, default) or "danger" for errors
 * - action: optional node, usually a <Button> such as "Try again"
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconTile } from "./IconTile";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "neutral" | "danger";
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, tone = "neutral", action }: EmptyStateProps) {
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className="flex flex-col items-center gap-3 px-6 py-10 text-center"
    >
      <IconTile icon={icon} tone={tone === "danger" ? "danger" : "accent"} />
      <p className="card-title">{title}</p>
      {description && <p className="page-subtitle max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
