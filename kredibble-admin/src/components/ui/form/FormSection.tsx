/**
 * FormSection: one titled group of fields.
 *
 *   wide:    Title + description (left, 11rem) | fields (right)
 *   narrow:  title and description on top, fields below
 *
 * It switches on the width of the space it sits in (a container query), not the screen, so it
 * also stacks inside a narrow column next to the sidebar.
 *
 * Props: title (Jakarta 16/22), description (12/16 muted, optional), children (the Fields).
 * Several sections in a row get a divider line between them.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FormSectionProps {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}

export function FormSection({ title, description, className, children }: FormSectionProps) {
  return (
    <section className={cn("@container border-line py-6 first:pt-0 last:pb-0 not-first:border-t", className)}>
      <div className="grid gap-4 @md:grid-cols-[11rem_minmax(0,1fr)] @md:gap-6">
        <div>
          <h2 className="card-title">{title}</h2>
          {description && <p className="caption mt-1">{description}</p>}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}
