"use client";

/**
 * RouteGuard: applies RequireAccess to every page that belongs to a nav item, using the nav's own screen keys.
 *
 * It lives in the dashboard shell, so a direct URL visit (typed, bookmarked or from a link) is checked exactly
 * like a click in the sidebar: the page is replaced by the "You don't have access to this page" state, and
 * nothing redirects, so there can be no loop. Pages that are not in the nav (the design review page) pass through.
 *
 * Form pages under a list (the invite form, a new article) need EDIT access to the list's screen; every other
 * page under it needs view access.
 */
import { usePathname } from "next/navigation";
import { findNavMatch } from "@/lib/nav";
import { RequireAccess } from "./RequireAccess";

/** Path segments that mark a form page under a list (/staff/invite, /content/articles/new). */
const FORM_SEGMENTS = ["invite", "new"];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const match = findNavMatch(usePathname());
  if (!match) return <>{children}</>;
  const level = FORM_SEGMENTS.includes(match.extra[0] ?? "") ? "edit" : "view";
  return (
    <RequireAccess screen={match.child.screen} level={level}>
      {children}
    </RequireAccess>
  );
}
