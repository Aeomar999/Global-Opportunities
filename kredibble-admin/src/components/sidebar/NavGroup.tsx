"use client";

/**
 * NavGroup: one expanded-sidebar group. A parent row (icon, label, chevron)
 * that toggles a list of child pages hung off a thin tree line, each with a
 * curved elbow, as in the design reference.
 *
 * - The tree is ONE inline SVG path: a single 1px trunk from the group row down to the last
 *   child, with a curved elbow branching into each child. One path means no gaps between
 *   segments and no doubled opacity where a branch meets the trunk.
 * - The active group's parent is the violet pill (white text on a gradient).
 * - The active child uses the glass style and gets aria-current="page".
 * - A child with a known count shows a count pill; unknown or zero is hidden.
 *
 * Props:
 * - group: the NavGroup from lib/nav.ts
 * - pathname: the current route (decides which child is active)
 * - open / onToggle: controlled by the Sidebar
 * - counts: known counts (see services/nav-counts.ts)
 * - onNavigate: called after a child link is clicked (closes the mobile drawer)
 */
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { isChildActive, isGroupActive, type NavGroup, navSlug } from "@/lib/nav";
import type { NavCounts } from "@/lib/services/nav-counts";
import { CountPill } from "@/components/ui/CountPill";

// Tree geometry in px. Each child row is 40px tall (h-10, the touch-target minimum), so row i's centre is i*40+20.
const ROW = 40;
const ELBOW_RADIUS = 10;
const ARM_END = 12; // where each elbow stops, just before the child's own padding

/** The whole tree as one SVG path (see the file header). */
function treePath(childCount: number): string {
  const mid = (i: number) => i * ROW + ROW / 2;
  // x = 0.5 puts the 1px trunk exactly on a pixel column, so it is crisp.
  // The trunk ends where the LAST elbow's curve begins, so the last child reads as one smooth corner.
  let d = `M0.5 0 V${mid(childCount - 1) - ELBOW_RADIUS}`;
  for (let i = 0; i < childCount; i++) {
    d += ` M0.5 ${mid(i) - ELBOW_RADIUS} Q0.5 ${mid(i)} ${0.5 + ELBOW_RADIUS} ${mid(i)} H${ARM_END}`;
  }
  return d;
}

interface NavGroupProps {
  group: NavGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  counts: NavCounts;
  onNavigate: () => void;
}

export function NavGroupItem({ group, pathname, open, onToggle, counts, onNavigate }: NavGroupProps) {
  const GroupIcon = group.icon;
  const active = isGroupActive(group, pathname);
  const listId = `nav-group-${group.group.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div>
      <button
        type="button"
        data-testid={`nav-group-${navSlug(group.group)}`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className={cn(
          "nav-group flex h-10 w-full items-center gap-3 whitespace-nowrap rounded-control px-3 text-left transition-colors duration-150 ease-out",
          active ? "sb-pill" : "text-sb-text hover:bg-white/6",
        )}
      >
        <GroupIcon size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
        <span className="flex-1">{group.group}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform duration-150 ease-out", open && "rotate-180")}
        />
      </button>

      {open && (
        <ul id={listId} className="relative ml-5">
          <svg
            aria-hidden="true"
            width={ARM_END + 1}
            height={group.children.length * ROW}
            fill="none"
            className="pointer-events-none absolute left-0 top-0"
          >
            <path d={treePath(group.children.length)} stroke="var(--color-sb-tree)" strokeWidth={1} />
          </svg>
          {group.children.map((child) => {
            const childActive = isChildActive(child, pathname);
            const count = child.countKey ? counts[child.countKey] : undefined;

            return (
              <li key={child.href} className="relative pl-4">
                <Link
                  href={child.href}
                  data-testid={`nav-item-${navSlug(child.label)}`}
                  onClick={onNavigate}
                  aria-current={childActive ? "page" : undefined}
                  className={cn(
                    "nav-child flex h-10 items-center gap-2 whitespace-nowrap rounded-inset px-3 transition-colors duration-150 ease-out",
                    childActive ? "glass-active font-medium text-sb-text" : "text-sb-muted hover:bg-white/6 hover:text-sb-text",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{child.label}</span>
                  {count !== undefined && count > 0 && <span className="shrink-0"><CountPill count={count} onDark label="pending" /></span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
