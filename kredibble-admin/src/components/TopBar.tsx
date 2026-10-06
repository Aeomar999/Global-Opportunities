"use client";

/**
 * TopBar: the 64px bar above every dashboard page (design brief, section 6).
 *
 * The bar also carries the content panel's rounded TOP-LEFT corner (the `panel-corner` utility, 1024px
 * and up): the bar is the top of the panel and it is sticky, so the corner sticks with it.
 *
 * Left: the menu button (below 1024px only) and the breadcrumbs.
 * Right: a "Mock data" pill (only in mock mode), the notifications bell (orange
 * dot when there are unread items) and the user menu (avatar, name, role).
 *
 * Breadcrumbs follow the brief and come from the nav model:
 * - Page:        Home / Group (caret menu of sibling pages) / Current page [count pill]
 * - Detail page: Home / Group (caret menu) / List page (a link) / Entity name
 * - Overview:    Home / Overview
 * Home is never dropped on desktop. The entity name comes from the page itself through
 * useBreadcrumbLabel(name) (lib/breadcrumb-label.ts); until the page has loaded its record the
 * segment is a skeleton, never "Details". Pages whose last segment is a plain word ("Invite", "New",
 * "History") show that word. On mobile only "… / Current page" shows.
 *
 * Props:
 * - onOpenNav: opens the sidebar drawer (the menu button calls it)
 * - counts: known counts, for the pill on the current page's crumb
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, ChevronLeft, Menu as MenuIcon } from "lucide-react";
import { getAdminUser } from "@/lib/api";
import { useCurrentBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { useRoles } from "@/components/access/RoleProvider";
import type { Screen } from "@/config/permissions";
import { ROLES, type Role } from "@/config/roles";
import { MAX_DEV_ROLES } from "@/config/dev-roles";
import { findNavMatch } from "@/lib/nav";
import type { NavCounts } from "@/lib/services/nav-counts";
import { getUnreadCount, isMockMode } from "@/lib/services/mock-mode";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Menu } from "@/components/ui/Menu";
import { TagPill } from "@/components/ui/TagPill";
import { useState } from "react";

interface TopBarProps {
  onOpenNav: () => void;
  counts: NavCounts;
}

// Square 40px icon-only button style shared by the menu and bell.
const ICON_BUTTON =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-control text-ink transition-colors duration-150 ease-out hover:bg-neutral-soft";

/** A plain word segment ("history" -> "History"), or null for an id-like segment ("opp-1", hex ids). */
const wordLabel = (segment: string) =>
  /^[a-z]{2,12}$/i.test(segment) ? segment.charAt(0).toUpperCase() + segment.slice(1) : null;

/** Builds the breadcrumb trail for a pathname (see the file header). */
function buildCrumbs(pathname: string, counts: NavCounts, entityLabel: string | undefined, canView: (screen: Screen) => boolean): Crumb[] {
  const match = findNavMatch(pathname);
  if (!match) return [{ label: "Home", href: "/" }];

  const { group, child, extra } = match;
  // The dropdown lists the group's pages and marks the one you are on (also for its detail pages).
  // Only pages the current roles can view.
  const siblings = group.children.filter((page) => canView(page.screen)).map((page) => ({ label: page.label, href: page.href, icon: page.icon, current: page.href === child.href }));
  const count = child.countKey ? counts[child.countKey] : undefined;
  const groupCrumb: Crumb = { label: group.group, menu: siblings };

  // The Overview group's only landing page would repeat itself ("Overview / Overview").
  if (child.href === "/") return [{ label: "Home", href: "/" }, { label: "Overview" }];

  // Detail page: Home / Group / List page / Entity name. The entity name is supplied by the page
  // (a skeleton until it is known); a plain word segment ("Invite", "New") is shown as that word.
  if (extra.length > 0) {
    const word = wordLabel(extra[0]);
    const last: Crumb = word ? { label: word } : entityLabel ? { label: entityLabel } : { label: "Loading", loading: true };
    return [{ label: "Home", href: "/" }, groupCrumb, { label: child.label, href: child.href }, last];
  }

  // Normal page: Home / Group / Current page [count]
  return [
    { label: "Home", href: "/" },
    groupCrumb,
    { label: child.label, count: count !== undefined && count > 0 ? count : undefined },
  ];
}

export function TopBar({ onOpenNav, counts }: TopBarProps) {
  const pathname = usePathname();
  const entityLabel = useCurrentBreadcrumbLabel();
  // Mock-mode values are constants, so reading them during render is safe (no hydration mismatch).
  const mock = isMockMode();
  const unread = getUnreadCount();
  const { can, devSwitcher, roles } = useRoles();
  // Phones (below 640px): no breadcrumb. A detail page (or a form under a list) gets a back chevron to its
  // parent list instead of the hamburger; the parent is the same page the breadcrumb links to.
  const match = findNavMatch(pathname);
  const back = match && match.extra.length > 0 ? { href: match.child.href, label: match.child.label } : null;

  return (
    <header className="lg:panel-corner sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-5 lg:px-7">
      <button type="button" onClick={onOpenNav} aria-label="Open navigation" className={cn(ICON_BUTTON, "lg:hidden", back && "max-sm:hidden")}>
        <MenuIcon size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {back && (
        <Link href={back.href} aria-label={`Back to ${back.label}`} data-testid="back-button" className={cn(ICON_BUTTON, "sm:hidden")}>
          <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      )}

      {/* display:none below 640px, so the trail is not announced either. */}
      <div className="min-w-0 flex-1 max-sm:hidden">
        <Breadcrumbs items={buildCrumbs(pathname, counts, entityLabel, (screen) => can(screen, "view"))} />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        {mock && (
          <span className="hidden sm:inline-flex">
            <TagPill>Mock data</TagPill>
          </span>
        )}
        {/* Development only: which role(s) the app is being viewed as. Change them in the account menu.
            Hidden below 640px (it crowds the bar); the account menu names the current role(s) as text instead. */}
        {devSwitcher && (
          <span className="hidden sm:inline-flex" data-testid="viewing-as">
            <TagPill>Viewing as {roles.map((role) => ROLES[role].label).join(" + ")}</TagPill>
          </span>
        )}
        <Link
          href="/notifications?tab=history"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn(ICON_BUTTON, "relative")}
        >
          <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
          {/* Orange dot with a white ring so it reads on the bar; the count is in the aria-label. */}
          {unread ? (
            <span aria-hidden="true" className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-surface bg-orange-500" />
          ) : null}
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { devSwitcher, devRoles, roles, setDevRoles, can } = useRoles();
  const roleText = roles.map((held) => ROLES[held].label).join(" + ");
  // The shell renders only after mounting, so reading localStorage here is safe.
  const [user] = useState(getAdminUser);
  const name = user?.name || "Admin";
  // Role line under the name: the session role when available, else "Admin".
  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Admin";

  return (
    <Menu
      label="Account"
      align="end"
      triggerAriaLabel={`Account menu for ${name}`}
      header={
        <div className="border-b border-line px-3 py-2" data-testid="account-roles">
          <p className="caption">{roles.length > 1 ? "Your roles" : "Your role"}</p>
          <p className="body-sm font-semibold text-ink">{roleText}</p>
        </div>
      }
      triggerClassName="flex h-11 items-center gap-2 rounded-control pl-1 pr-2 transition-colors duration-150 ease-out hover:bg-neutral-soft"
      items={[
        ...(can("team", "view") ? [{ label: "Team", href: "/team" }] : []),
        ...(can("roles_permissions", "view") ? [{ label: "Roles & Permissions", href: "/team?tab=roles" }] : []),
        // Development only: view the app as one or two roles (at most two; none chosen = the real session role).
        ...(devSwitcher
          ? (Object.keys(ROLES) as Role[]).map((role, index) => ({
              label: ROLES[role].label,
              checked: (devRoles.length > 0 ? devRoles : roles).includes(role),
              keepOpen: true,
              groupLabel: index === 0 ? "View as (dev only)" : undefined,
              disabled: !devRoles.includes(role) && devRoles.length >= MAX_DEV_ROLES,
              onSelect: () => setDevRoles(devRoles.includes(role) ? devRoles.filter((r) => r !== role) : [...(devRoles.length > 0 ? devRoles : []), role]),
            }))
          : []),
      ]}
    >
      <Avatar name={name} />
      <span className="hidden min-w-0 text-left sm:block">
        <span className="body-sm block max-w-32 truncate font-semibold text-ink">{name}</span>
        <span className="caption block">{role}</span>
      </span>
      <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" className="text-muted" />
    </Menu>
  );
}
