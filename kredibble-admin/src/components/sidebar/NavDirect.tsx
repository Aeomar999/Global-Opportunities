"use client";

/**
 * NavDirectItem: one page shown as a direct row, not inside a group. Used for a group that has exactly one page the
 * current roles can see (see splitNav in lib/nav.ts); such rows sit at the end of the nav.
 *
 * - Expanded sidebar and phone drawer: a 40px row with the page icon and label (the active page is the violet pill).
 * - Rail: an icon-only link with a tooltip carrying the label.
 * - Same test id as a child inside a group (nav-item-<label>), so a page is found the same way wherever it sits.
 *
 * Props: child (the NavChild), pathname, counts (known counts only), rail, onNavigate (closes the mobile drawer).
 */
import Link from "next/link";
import { cn } from "@/lib/cn";
import { isChildActive, navSlug, type NavChild } from "@/lib/nav";
import type { NavCounts } from "@/lib/services/nav-counts";
import { CountPill } from "@/components/ui/CountPill";
import { Tooltip } from "@/components/ui/Tooltip";

interface NavDirectProps {
  child: NavChild;
  pathname: string;
  counts: NavCounts;
  rail: boolean;
  onNavigate: () => void;
}

export function NavDirectItem({ child, pathname, counts, rail, onNavigate }: NavDirectProps) {
  const Icon = child.icon;
  const active = isChildActive(child, pathname);
  const count = child.countKey ? counts[child.countKey] : undefined;
  const hasCount = count !== undefined && count > 0;

  const link = (
    <Link
      href={child.href}
      data-testid={`nav-item-${navSlug(child.label)}`}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? (hasCount ? `${child.label}, ${count} pending` : child.label) : undefined}
      className={cn(
        "nav-group relative flex h-10 items-center whitespace-nowrap rounded-control transition-colors duration-150 ease-out",
        rail ? "mx-auto size-10 justify-center" : "w-full gap-3 px-3",
        active ? "sb-pill" : "text-sb-text hover:bg-white/6",
      )}
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
      {!rail && <span className="flex-1">{child.label}</span>}
      {!rail && hasCount && <CountPill count={count} onDark label="pending" />}
      {rail && hasCount && (
        <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-sb-bg bg-orange-500" />
      )}
    </Link>
  );

  return rail ? (
    <Tooltip label={child.label} placement="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
