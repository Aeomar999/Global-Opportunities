"use client";

/**
 * RailGroup: one group in the collapsed (72px) sidebar rail.
 *
 * - An icon-only button. Hover or keyboard focus shows a tooltip with the
 *   group name. The active group is the violet pill.
 * - A small orange dot marks a group that has pending counts.
 * - Clicking opens a flyout (dark glass panel, 220px) beside the rail listing
 *   the group's pages. Esc, a click outside, or tabbing out closes it, and
 *   Esc / selecting a page returns focus to the icon.
 *
 * Props:
 * - group, pathname, counts: as in NavGroupItem
 * - flyoutOpen / onFlyoutChange: controlled by the Sidebar (only one flyout at a time)
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { isChildActive, isGroupActive, type NavGroup, navSlug } from "@/lib/nav";
import type { NavCounts } from "@/lib/services/nav-counts";
import { CountPill } from "@/components/ui/CountPill";
import { Tooltip } from "@/components/ui/Tooltip";

const FLYOUT_GAP = 12; // space between the rail and the flyout, in px

interface RailGroupProps {
  group: NavGroup;
  pathname: string;
  counts: NavCounts;
  flyoutOpen: boolean;
  onFlyoutChange: (open: boolean) => void;
}

export function RailGroup({ group, pathname, counts, flyoutOpen, onFlyoutChange }: RailGroupProps) {
  const GroupIcon = group.icon;
  const active = isGroupActive(group, pathname);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const pending = group.children.reduce((sum, child) => sum + ((child.countKey && counts[child.countKey]) || 0), 0);

  const close = (returnFocus: boolean) => {
    onFlyoutChange(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const toggle = () => {
    if (flyoutOpen) return close(false);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Line the flyout up with the icon, beside the rail's right edge.
      const rail = triggerRef.current?.closest("aside")?.getBoundingClientRect();
      setPosition({ left: (rail?.right ?? rect.right) + FLYOUT_GAP, top: rect.top });
    }
    onFlyoutChange(true);
  };

  // While open: focus the first link, close on Escape / outside click.
  useEffect(() => {
    if (!flyoutOpen) return;
    flyoutRef.current?.querySelector<HTMLElement>("a")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onFlyoutChange(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!flyoutRef.current?.contains(target) && !triggerRef.current?.contains(target)) onFlyoutChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [flyoutOpen, onFlyoutChange]);

  return (
    <>
      <Tooltip label={group.group} placement="right">
        <button
          ref={triggerRef}
          type="button"
          data-testid={`nav-group-${navSlug(group.group)}`}
          aria-haspopup="true"
          aria-expanded={flyoutOpen}
          aria-label={pending > 0 ? `${group.group}, ${pending} pending` : group.group}
          onClick={toggle}
          className={cn(
            "relative mx-auto flex size-10 items-center justify-center rounded-control transition-colors duration-150 ease-out",
            active ? "sb-pill" : "text-sb-text hover:bg-white/6",
          )}
        >
          <GroupIcon size={18} strokeWidth={1.75} aria-hidden="true" />
          {pending > 0 && (
            <span aria-hidden="true" className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-sb-bg bg-orange-500" />
          )}
        </button>
      </Tooltip>

      {flyoutOpen && position && (
        <section
          ref={flyoutRef}
          aria-label={group.group}
          // Closes when focus leaves the flyout without going back to its icon.
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (next && !flyoutRef.current?.contains(next) && !triggerRef.current?.contains(next)) onFlyoutChange(false);
          }}
          className="dark-surface fixed z-50 w-55 rounded-card bg-sb-bg shadow-pop"
          style={{ left: position.left, top: position.top }}
        >
          <div className="glass rounded-card p-2">
            <p className="caption px-3 py-2 font-semibold uppercase tracking-wide">{group.group}</p>
            <ul>
              {group.children.map((child) => {
                const ChildIcon = child.icon;
                const childActive = isChildActive(child, pathname);
                const count = child.countKey ? counts[child.countKey] : undefined;
                return (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      data-testid={`nav-item-${navSlug(child.label)}`}
                      onClick={() => close(false)}
                      aria-current={childActive ? "page" : undefined}
                      className={cn(
                        "nav-child flex h-10 items-center gap-2 whitespace-nowrap rounded-inset px-3 transition-colors duration-150 ease-out",
                        childActive ? "bg-white/10 font-medium text-sb-text" : "text-sb-muted hover:bg-white/6 hover:text-sb-text",
                      )}
                    >
                      <ChildIcon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
                      <span className="flex-1">{child.label}</span>
                      {count !== undefined && count > 0 && <CountPill count={count} onDark label="pending" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
