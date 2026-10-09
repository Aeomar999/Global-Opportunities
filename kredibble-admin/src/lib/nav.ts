/**
 * Navigation: the single source for the sidebar, the rail flyouts, the
 * command palette and the breadcrumbs.
 *
 * Two levels: groups (parents) contain pages (children). Only children have
 * routes. A group is "active" when any of its children is.
 *
 * Every child has a `screen` key (src/config/permissions.ts). What a person sees is the full list filtered
 * by `visibleNavGroups(can)`: a page appears only where they can at least view its screen, and a group with
 * no visible page is hidden. The same screen key guards the route itself (RequireAccess).
 *
 * `match` lists extra path prefixes that should also highlight a child ("Team" stays highlighted on a member's
 * page and the invite form, /staff/...).
 */
import {
  BarChart3, Bell, Briefcase, CalendarDays, CalendarRange, Building2, Database, FileText, Flag, GraduationCap, HandCoins, Handshake,
  Hash, LayoutDashboard, Megaphone, Network, Quote, Settings, Settings2, Share2, ShieldCheck, Target, Trophy, UserCog, Users, type LucideIcon,
} from "lucide-react";
import type { AccessLevel, Screen } from "@/config/permissions";

/** Counts the sidebar can show. Unknown counts are hidden, never shown as 0. */
export type CountKey = "pendingVerifications" | "openReports" | "pendingRecords" | "pendingTestimonials" | "pendingAmbassadorRequests";

export interface NavChild {
  label: string;
  href: string;
  icon: LucideIcon;
  /** The permission screen that decides whether this page is shown and reachable. */
  screen: Screen;
  /** Entity accent for this page's icon tile: Opportunities and Programs are orange, Partners and Network purple. */
  accent?: "orange" | "purple";
  /** Which count (if any) to show as a pill next to this page. */
  countKey?: CountKey;
  /** Extra path prefixes that also mark this page active (see file header). */
  match?: string[];
}

export interface NavGroup {
  group: string;
  icon: LucideIcon;
  children: NavChild[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "Dashboard",
    icon: LayoutDashboard,
    children: [
      { label: "Overview", href: "/", icon: LayoutDashboard, screen: "overview" },
      { label: "Insights", href: "/analytics", icon: BarChart3, screen: "insights" },
      { label: "Monthly report", href: "/monthly-report", icon: CalendarRange, screen: "monthly_report" },
      // "My scorecard" for most roles; the same screen has a "Team" tab for the desk lead and the super admin.
      { label: "Scorecard", href: "/scorecard", icon: Target, screen: "my_scorecard" },
    ],
  },
  {
    group: "Opportunities",
    icon: Briefcase,
    children: [
      { label: "Opportunities Queue", href: "/opportunities", icon: Briefcase, screen: "opportunities_queue", accent: "orange" },
      { label: "Events", href: "/events", icon: CalendarDays, screen: "events" },
      { label: "Grants", href: "/grants", icon: HandCoins, screen: "grants" },
      { label: "Programs", href: "/programs", icon: GraduationCap, screen: "programs", accent: "orange" },
    ],
  },
  {
    group: "Partners & network",
    icon: Handshake,
    children: [
      { label: "Partners", href: "/partners", icon: Handshake, screen: "partners", accent: "purple" },
      { label: "Network", href: "/network", icon: Network, screen: "network", accent: "purple" },
      { label: "Ambassadors", href: "/ambassador-applications", icon: Megaphone, screen: "network", accent: "purple", countKey: "pendingAmbassadorRequests" },
      { label: "Leaderboard", href: "/leaderboard", icon: Trophy, screen: "leaderboard" },
    ],
  },
  {
    group: "People",
    icon: Users,
    children: [
      { label: "Seekers", href: "/seekers", icon: Users, screen: "seekers" },
      { label: "Hirers", href: "/hirers", icon: Building2, screen: "hirers" },
      { label: "Channels", href: "/community", icon: Hash, screen: "channels" },
      { label: "Database", href: "/database", icon: Database, screen: "database", countKey: "pendingRecords" },
    ],
  },
  {
    group: "Trust & safety",
    icon: ShieldCheck,
    children: [
      { label: "Verification Queue", href: "/verification", icon: ShieldCheck, screen: "verification", countKey: "pendingVerifications" },
      { label: "Reports Queue", href: "/reports", icon: Flag, screen: "reports_queue", countKey: "openReports" },
    ],
  },
  {
    group: "Content",
    icon: FileText,
    children: [
      { label: "Career Resources", href: "/content/articles", icon: FileText, screen: "career_resources" },
      { label: "Reference data", href: "/reference-data", icon: Database, screen: "reference_data" },
      { label: "Social", href: "/social", icon: Share2, screen: "social" },
      { label: "Testimonials", href: "/testimonials", icon: Quote, screen: "testimonials", countKey: "pendingTestimonials" },
    ],
  },
  {
    group: "Comms & admin",
    icon: Settings2,
    children: [
      { label: "Notifications", href: "/notifications", icon: Bell, screen: "notifications" },
      { label: "Team", href: "/team", icon: UserCog, screen: "team", match: ["/staff"] },
      { label: "Settings", href: "/settings", icon: Settings, screen: "settings" },
    ],
  },
];

/** The page that owns a screen (the first nav entry for it): where a KPI card or a queue row links to. */
export function hrefForScreen(screen: Screen): string {
  for (const group of NAV_GROUPS) for (const child of group.children) if (child.screen === screen) return child.href;
  return "/";
}

/** The nav a person may see: only pages whose screen they can view; groups left empty are dropped. */
export function visibleNavGroups(can: (screen: Screen, level: AccessLevel) => boolean): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, children: group.children.filter((child) => can(child.screen, "view")) })).filter(
    (group) => group.children.length > 0,
  );
}

/**
 * Splits the visible groups: a group with TWO or more visible pages stays a group; a group left with exactly ONE
 * visible page is not shown as a group (a lone page under a parent is just a click for nothing). That page becomes a
 * direct row, listed after the groups, in the order of the groups it came from.
 */
export function splitNav(groups: NavGroup[]): { groups: NavGroup[]; direct: NavChild[] } {
  return {
    groups: groups.filter((group) => group.children.length > 1),
    direct: groups.filter((group) => group.children.length === 1).map((group) => group.children[0]),
  };
}

/** True when `pathname` is this child's page, a page nested under it, or under one of its `match` prefixes. */
export function isChildActive(child: NavChild, pathname: string): boolean {
  if (child.href === "/") return pathname === "/";
  const prefixes = [child.href, ...(child.match ?? [])];
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const isGroupActive = (group: NavGroup, pathname: string) =>
  group.children.some((child) => isChildActive(child, pathname));

export interface NavMatch {
  group: NavGroup;
  child: NavChild;
  /**
   * Path segments after the part of the route that belongs to the child.
   * "/seekers/42" -> ["42"] (a detail page); "/staff/invite" -> ["invite"]
   * (a page reached through the child's `match` prefix); the child's own page -> [].
   */
  extra: string[];
}

/** Finds the nav page a pathname belongs to (used by the breadcrumbs and the route guard). */
export function findNavMatch(pathname: string): NavMatch | null {
  for (const group of NAV_GROUPS) {
    for (const child of group.children) {
      if (!isChildActive(child, pathname)) continue;
      if (child.href === "/") return { group, child, extra: [] };
      // The first prefix (own href, then match prefixes) that contains this path.
      const prefix = [child.href, ...(child.match ?? [])].find((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? child.href;
      return { group, child, extra: pathname.slice(prefix.length).split("/").filter(Boolean) };
    }
  }
  return null;
}

/** "Trust & safety" -> "trust-safety". Used to build stable data-testid values for the nav. */
export const navSlug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
