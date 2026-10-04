/**
 * TagPill: a small purple-tinted pill for a label that is NOT a status (a staff
 * role, an opportunity type). Statuses use StatusBadge instead.
 * Purple-700 on purple-50 is 9.7:1.
 *
 * Props:
 * - children: the label
 * - icon: optional lucide icon before the label
 * - className: layout classes only (visibility, spacing)
 */
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function TagPill({ children, icon: Icon, className }: { children: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <span className={cn("badge-text inline-flex w-fit shrink-0 items-center gap-1.5 rounded-pill bg-purple-50 px-3 py-1 text-purple-700", className)}>
      {Icon && <Icon size={12} strokeWidth={2} aria-hidden="true" />}
      {children}
    </span>
  );
}
