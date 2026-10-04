/**
 * Card: the base surface for every content block.
 * White, 1px border, 16px radius, 1px soft shadow (the `card-surface` utility
 * in globals.css) with 20px padding.
 *
 * Props:
 * - as: element to render ("div" by default; use "section" for labelled regions)
 * - padding: "md" = 20px (default, the brief's card padding) or "lg" = 24px
 * - flush: remove the padding (for tables / lists that run edge to edge)
 * - ariaLabel: names a <section> so it is a landmark region ("New submissions"); screen-reader
 *   users can jump between the Overview's cards
 * - className: extra classes (layout only, such as spans or margins)
 *
 * CardHeader: the standard card header. Title (Jakarta 16/22) and subtitle
 * (Inter 12/16 muted) on the left, an optional action on the right (usually a
 * purple-700 text link such as "See more").
 * Props: title, subtitle?, action?, as? (heading level, default "h2").
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps {
  as?: "div" | "section" | "article";
  padding?: "md" | "lg";
  flush?: boolean;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ as: Tag = "div", padding = "md", flush = false, ariaLabel, className, children }: CardProps) {
  return (
    <Tag aria-label={ariaLabel} className={cn("card-surface", !flush && (padding === "lg" ? "p-6" : "p-5"), flush && "overflow-hidden", className)}>
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}

export function CardHeader({ title, subtitle, action, as: Heading = "h2", className }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <Heading className="card-title">{title}</Heading>
        {subtitle && <p className="card-subtitle mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 text-sm font-semibold text-purple-700">{action}</div>}
    </div>
  );
}
