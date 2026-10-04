import { cookies } from "next/headers";
import { DashboardShell } from "@/components/DashboardShell";
import { DEV_ROLES_COOKIE, parseDevRoles } from "@/config/dev-roles";
import { SIDEBAR_COOKIE } from "@/config/sidebar";

/**
 * Dashboard layout (server component).
 * Its one job is to read two cookies on the server, so the first paint is already right (no flash):
 * the "sidebar" cookie (expanded or collapsed) and the dev role switcher's cookie (which roles to view as;
 * the client ignores it in production).
 * Everything interactive lives in DashboardShell.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const saved = jar.get(SIDEBAR_COOKIE)?.value;
  const initialDevRoles = parseDevRoles(jar.get(DEV_ROLES_COOKIE)?.value);
  const initialSidebar = saved === "expanded" || saved === "collapsed" ? saved : null;

  return <DashboardShell initialSidebar={initialSidebar} initialDevRoles={initialDevRoles}>{children}</DashboardShell>;
}
