"use client";

/**
 * StatusBanner: slim banner above the Overview rows when something failed.
 * Shows an icon, a message and one action:
 * - unauthorized: "Your session has expired." + a Sign in link to /login
 * - rate_limited: "Try again" disabled with a countdown (Retry-After, else 30s)
 * - partial / failed: "Try again"
 *
 * There are never automatic retries: "Try again" only calls `onRetry`.
 *
 * Props:
 * - issue: the issue from getOverview()
 * - onRetry: re-runs getOverview()
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { OverviewIssue } from "@/lib/services/overview";
import { Button, buttonClasses } from "@/components/ui/Button";

export function StatusBanner({ issue, onRetry }: { issue: OverviewIssue; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-control border border-line bg-danger-soft px-4 py-3"
    >
      <AlertTriangle size={18} aria-hidden="true" className="shrink-0 text-danger" />
      <p className="min-w-0 flex-1 text-sm text-ink">{issue.message}</p>

      {issue.kind === "unauthorized" ? (
        <Link href="/login" className={buttonClasses("secondary")}>
          Sign in
        </Link>
      ) : (
        <RetryButton seconds={issue.kind === "rate_limited" ? (issue.retryAfter ?? 30) : 0} onRetry={onRetry} />
      )}
    </div>
  );
}

/** "Try again" button that stays disabled and counts down while `seconds` > 0. */
function RetryButton({ seconds, onRetry }: { seconds: number; onRetry: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  return (
    <Button variant="secondary" onClick={onRetry} disabled={remaining > 0}>
      {remaining > 0 ? `Try again in ${remaining}s` : "Try again"}
    </Button>
  );
}
