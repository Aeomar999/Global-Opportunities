"use client";

/**
 * RequireAccess: wraps a page (or any block) that only some roles may open.
 *
 * - allowed: renders its children
 * - not allowed: a "You don't have access to this page" empty state that names the role that owns the
 *   screen and links to the Overview. Never a blank page and never a redirect, so there is no loop.
 *
 * It guards direct URL visits too, because the check runs where the page renders. The dashboard shell also
 * applies it to every nav route (RouteGuard), so existing pages need no change.
 *
 * Props:
 * - screen: the permission screen (src/config/permissions.ts)
 * - level: "view" (default) or "edit" (for pages that only editors may open, such as an invite form)
 * - children: the page
 */
import Link from "next/link";
import { Lock } from "lucide-react";
import { owningRoles, type AccessLevel, type Screen } from "@/config/permissions";
import { ROLES } from "@/config/roles";
import { joinList } from "@/lib/format";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useRoles } from "./RoleProvider";

interface RequireAccessProps {
  screen: Screen;
  level?: AccessLevel;
  children: React.ReactNode;
}

export function RequireAccess({ screen, level = "view", children }: RequireAccessProps) {
  const { can } = useRoles();
  if (can(screen, level)) return <>{children}</>;

  const owners = owningRoles(screen).map((role) => ROLES[role].label);
  return (
    <div data-testid="no-access" className="mx-auto w-full max-w-xl">
    <Card as="section" ariaLabel="No access">
      <EmptyState
        icon={Lock}
        title="You don't have access to this page"
        description={`This page is looked after by the ${joinList(owners)} ${owners.length === 1 ? "role" : "roles"}. Ask a Desk Lead or Super Admin if you need access.`}
        action={
          <Link href="/" className={buttonClasses("secondary")}>
            Go to Overview
          </Link>
        }
      />
    </Card>
    </div>
  );
}
