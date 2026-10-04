/**
 * DangerZone: the separate card at the bottom of a detail page that holds the
 * DESTRUCTIVE actions (Suspend, Reject, Remove, Cancel).
 *
 * It has a danger-tinted border and a one-line explanation of what the action
 * does. Its buttons are red (Button variant "danger"), never orange. Each button
 * should open a ConfirmDialog rather than act directly.
 *
 * Props:
 * - explanation: one line saying what these actions do ("Suspending blocks this person from signing in.")
 * - children: the action button(s)
 */
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function DangerZone({ explanation, children }: { explanation: string; children: ReactNode }) {
  return (
    <Card as="section" ariaLabel="Danger zone" className="border-danger/40">
      <h2 className="font-display text-base font-bold leading-5.5 text-danger">Danger zone</h2>
      <p className="page-subtitle mt-1">{explanation}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
    </Card>
  );
}
