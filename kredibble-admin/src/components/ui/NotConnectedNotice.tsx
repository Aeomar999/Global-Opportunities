"use client";

/**
 * NotConnectedNotice: says plainly that a page still shows sample data.
 *
 * Renders only outside mock mode: in mock mode every page shows sample data on purpose. Used on screens whose
 * backend arrives in a later plan (Team, staff and roles: Plan 2d; notifications and reference data: later),
 * so nobody mistakes sample records for live ones (SEC-077).
 */
import { Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { isMockMode } from "@/lib/services/mock-mode";

export function NotConnectedNotice({ className }: { className?: string }) {
  if (isMockMode()) return null;
  return (
    <p
      role="note"
      data-testid="not-connected-notice"
      className={cn(
        "body-sm flex items-center gap-2 rounded-control border border-input bg-surface-2 px-3 py-2 text-muted",
        className,
      )}
    >
      <Info size={16} aria-hidden="true" />
      This page isn&apos;t connected to live data yet. What you see is sample data.
    </p>
  );
}
