"use client";

/**
 * Sidebar: the dark-violet app navigation (design brief, section 5).
 *
 * Three layouts from one component:
 * - Expanded (248px): brand row, glass search, two-level nav, glass user card.
 * - Rail (72px, desktop only): icons only. Hover/focus shows a tooltip, a click
 *   opens a flyout of the group's pages, groups with pending counts show a dot.
 * - Drawer (below 1024px): the expanded layout slides in over the page with a
 *   focus trap; Esc or the close button dismisses it. There is no rail on mobile.
 *
 * Details
 * - Data comes from NAV_GROUPS (lib/nav.ts), filtered by the current roles (visibleNavGroups). The group holding the active route
 *   (nested routes count: a detail page highlights its parent list) is the violet
 *   pill and is open. Other groups can be opened too, several at once; switching role resets them.
 *   A group with exactly one visible page is shown as a direct row at the end of the nav (splitNav).
 * - Sticky, 100dvh: the nav list scrolls inside; brand and user blocks stay put.
 * - The sidebar itself has square corners and sits flush to the viewport. The curve of the
 *   design reference belongs to the CONTENT panel's top-left corner (see TopBar and the
 *   `panel-corner` utility), so the dark colour appears to wrap around the content.
 *   A faint purple glow rises from the bottom edge.
 * - Width animates 200ms ease-out (disabled under prefers-reduced-motion by the
 *   global rule in globals.css).
 *
 * Props:
 * - collapsed: the user's rail preference (only applied at 1024px and wider)
 * - onToggleCollapsed: flips that preference (the shell persists it)
 * - drawerOpen / onCloseDrawer: mobile drawer state
 * - counts: known count values for the pills and rail dots
 * - onOpenPalette: opens the command palette (the search field is its trigger)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Search, X } from "lucide-react";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/cn";
import { useRoles } from "@/components/access/RoleProvider";
import { isGroupActive, splitNav, visibleNavGroups } from "@/lib/nav";
import type { NavCounts } from "@/lib/services/nav-counts";
import { useMediaQuery, useModifierLabel } from "@/lib/use-media-query";
import { BrandMark } from "@/components/BrandMark";
import { Kbd } from "@/components/ui/Kbd";
import { Tooltip } from "@/components/ui/Tooltip";
import { NavDirectItem } from "@/components/sidebar/NavDirect";
import { NavGroupItem } from "@/components/sidebar/NavGroup";
import { RailGroup } from "@/components/sidebar/RailGroup";
import { UserCard } from "@/components/sidebar/UserCard";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  counts: NavCounts;
  onOpenPalette: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

export function Sidebar({ collapsed, onToggleCollapsed, drawerOpen, onCloseDrawer, counts, onOpenPalette }: SidebarProps) {
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const modifier = useModifierLabel();
  // Only the pages the current roles can view (a group with none is hidden).
  const { can } = useRoles();
  // Groups with two or more pages stay groups; a group with exactly one visible page becomes a direct row at the end.
  const { navGroups, directItems } = useMemo(() => {
    const split = splitNav(visibleNavGroups(can));
    return { navGroups: split.groups, directItems: split.direct };
  }, [can]);
  // Identifies WHICH groups are visible. When it changes (another role was chosen, or the matrix was saved) the
  // hand-opened groups of the previous nav are forgotten, so only the active group is open.
  const navKey = navGroups.map((group) => group.group).join("|");

  // The rail only exists on desktop; the drawer is always the full layout.
  const rail = collapsed && isDesktop;

  // Which groups are open = userOpened + the ACTIVE group.
  // - userOpened: groups the user opened by clicking. They stay open across navigation.
  // - The active group is "auto-opened": it is open only while it holds the current page. When
  //   navigation moves to a different group, the previous auto-opened group closes again unless
  //   the user had opened it by hand.
  // - Clicking an OPEN group closes it and removes it from userOpened. If it is the active group
  //   it stays closed for this page ("dismissed") until the next navigation.
  // - Expanding from the rail re-opens the active group (the rail never showed groups).
  // The state is adjusted during render (React's "derive state from props" pattern) instead of in
  // an effect, so there is never a frame that shows the wrong groups open.
  const activeGroup = navGroups.find((group) => isGroupActive(group, pathname))?.group ?? null;
  const [openState, setOpenState] = useState({ path: pathname, rail, navKey, userOpened: [] as string[], dismissed: [] as string[] });
  const navChanged = openState.navKey !== navKey;
  const navigated = openState.path !== pathname;
  const expandedFromRail = openState.rail && !rail;
  if (navChanged || navigated || expandedFromRail || openState.rail !== rail) {
    // A new page (or a fresh expand) forgets which groups were dismissed on the previous page; a different nav
    // (another role) forgets the hand-opened groups too, because they belonged to the other role's nav.
    setOpenState({ path: pathname, rail, navKey, userOpened: navChanged ? [] : openState.userOpened, dismissed: [] });
  }
  const dismissedHere = navChanged || navigated || expandedFromRail ? [] : openState.dismissed;
  const userOpenedHere = navChanged ? [] : openState.userOpened;
  const isOpen = (name: string) =>
    userOpenedHere.includes(name) || (name === activeGroup && !dismissedHere.includes(name));

  const toggleGroup = (name: string) =>
    setOpenState((state) => {
      const open = state.userOpened.includes(name) || (name === activeGroup && !state.dismissed.includes(name));
      return open
        ? {
            ...state,
            userOpened: state.userOpened.filter((g) => g !== name), // closing removes it from userOpened
            dismissed: name === activeGroup ? [...state.dismissed, name] : state.dismissed,
          }
        : { ...state, userOpened: [...state.userOpened, name], dismissed: state.dismissed.filter((g) => g !== name) };
    });

  // Rail: only one flyout at a time.
  const [flyout, setFlyout] = useState<string | null>(null);
  const setFlyoutFor = useCallback((name: string) => (open: boolean) => setFlyout(open ? name : null), []);

  // Drawer: focus trap, Esc closes, focus returns to what opened it.
  useEffect(() => {
    if (!drawerOpen || isDesktop) return;
    const aside = asideRef.current;
    if (!aside) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => [...aside.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onCloseDrawer();
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [drawerOpen, isDesktop, onCloseDrawer]);

  const toggleLabel = rail ? "Expand sidebar" : "Collapse sidebar";

  return (
    // The wrapper owns position, width (and its 200ms animation) and the drawer slide. The aside fills it.
    <div
      data-print-hide
      className={cn(
        "z-40 shrink-0",
        // Desktop: sticky full-height column; width follows the expanded / rail state.
        "lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:transition-[width] lg:duration-200 lg:ease-out",
        rail ? "lg:w-rail" : "lg:w-sidebar",
        // Mobile: fixed drawer, always the expanded width. While closed it is invisible, so
        // its links cannot be reached by Tab or by screen readers.
        "max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:h-dvh max-lg:w-sidebar max-lg:transition-transform",
        drawerOpen ? "max-lg:translate-x-0" : "max-lg:invisible max-lg:-translate-x-full",
      )}
    >
      <aside
        ref={asideRef}
        aria-label="Sidebar"
        // Square corners, flush to the viewport edge (the rounded corner is on the content panel).
        className="dark-surface relative flex h-full w-full flex-col overflow-hidden bg-sb-bg text-sb-text max-lg:shadow-pop"
      >
        {/* Glow rising from the bottom edge */}
        <div aria-hidden="true" className="sb-glow pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />

        {/* Brand row (64px) */}
        {rail ? (
          <div className="relative flex shrink-0 flex-col items-center gap-1 pt-4">
            <BrandMark size={36} />
            <Tooltip label={`${toggleLabel} (${modifier} B)`} placement="right">
              <button
                type="button"
                data-testid="sidebar-toggle"
                onClick={onToggleCollapsed}
                aria-expanded={false}
                aria-label={toggleLabel}
                aria-keyshortcuts="Control+B Meta+B"
                className="flex size-10 items-center justify-center rounded-inset text-sb-muted transition-colors duration-150 ease-out hover:bg-white/10 hover:text-sb-text"
              >
                <ChevronsRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="relative flex h-16 shrink-0 items-center gap-2 pl-4 pr-2">
            <BrandMark size={36} />
            <div className="min-w-0 flex-1">
              <p className="brand-name">{BRAND.name}</p>
              {/* One line in the expanded desktop sidebar (it fits at 11px); it wraps only in the narrower phone drawer. */}
              <p className={cn("brand-sub leading-tight", isDesktop ? "whitespace-nowrap" : "break-words")} data-testid="brand-tagline">
                {BRAND.sub}
              </p>
            </div>
            {isDesktop ? (
              <Tooltip label={`${toggleLabel} (${modifier} B)`} placement="bottom">
                <button
                  type="button"
                  data-testid="sidebar-toggle"
                  onClick={onToggleCollapsed}
                  aria-expanded={true}
                  aria-label={toggleLabel}
                  aria-keyshortcuts="Control+B Meta+B"
                  className="flex size-10 shrink-0 items-center justify-center rounded-inset text-sb-muted transition-colors duration-150 ease-out hover:bg-white/10 hover:text-sb-text"
                >
                  <ChevronsLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={onCloseDrawer}
                aria-label="Close navigation"
                className="flex size-10 shrink-0 items-center justify-center rounded-inset text-sb-muted hover:bg-white/10 hover:text-sb-text"
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Search: opens the command palette */}
        <div className={cn("relative shrink-0 py-2", rail ? "flex justify-center" : "px-4")}>
          {rail ? (
            <Tooltip label={`Search (${modifier} K)`} placement="right">
              <button
                type="button"
                onClick={onOpenPalette}
                aria-label="Search pages"
                aria-keyshortcuts="Control+K Meta+K"
                className="glass flex size-10 items-center justify-center rounded-control text-sb-muted transition-colors duration-150 ease-out hover:text-sb-text"
              >
                <Search size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          ) : (
            <button
              type="button"
              onClick={onOpenPalette}
              aria-label="Search pages"
              aria-keyshortcuts="Control+K Meta+K"
              className="glass flex h-10 w-full items-center gap-2 rounded-control px-3 text-left text-sb-muted transition-colors duration-150 ease-out hover:text-sb-text"
            >
              <Search size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />
              <span className="input-text flex-1">Search</span>
              <Kbd onDark>{`${modifier} K`}</Kbd>
            </button>
          )}
        </div>

        {/* Navigation: scrolls inside the sidebar when there are more groups than fit */}
        <nav aria-label="Main" className={cn("relative min-h-0 flex-1 overflow-y-auto py-2", rail ? "px-0" : "px-3")}>
          <ul className={cn(rail ? "flex flex-col items-center gap-1" : "space-y-1")}>
            {navGroups.map((group) => {
              return (
                <li key={group.group} className={rail ? "flex w-full justify-center" : undefined}>
                  {rail ? (
                    <RailGroup
                      group={group}
                      pathname={pathname}
                      counts={counts}
                      flyoutOpen={flyout === group.group}
                      onFlyoutChange={setFlyoutFor(group.group)}
                    />
                  ) : (
                    <NavGroupItem
                      group={group}
                      pathname={pathname}
                      open={isOpen(group.group)}
                      onToggle={() => toggleGroup(group.group)}
                      counts={counts}
                      onNavigate={onCloseDrawer}
                    />
                  )}
                </li>
              );
            })}
            {directItems.map((child) => (
              <li key={child.href} className={rail ? "flex w-full justify-center" : undefined}>
                <NavDirectItem child={child} pathname={pathname} counts={counts} rail={rail} onNavigate={onCloseDrawer} />
              </li>
            ))}
          </ul>
        </nav>

        {/* User card + Log Out */}
        {/* In development the Next.js dev badge sits at the bottom-left, so leave room under the user card. */}
        <div className={cn("relative shrink-0 p-3", process.env.NODE_ENV === "development" && "pb-16")}>
          <UserCard rail={rail} />
        </div>
      </aside>
    </div>
  );
}
