"use client";

/**
 * UserCard: the glass card at the bottom of the sidebar, with the signed-in
 * person and the Log Out action.
 *
 * - Expanded: avatar, name (13/18 600), role (12/16 muted) and a full-width
 *   "Log Out" button with its visible text.
 * - Rail: just the avatar, and a Log Out icon button with a tooltip.
 *
 * Logging out calls the API, but the local session is cleared and the user is
 * sent to /login even if that request fails, so nobody is left stuck.
 *
 * Props:
 * - rail: render the icon-only version
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clearAdminSession, getAdminUser, logoutAdmin } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

export function UserCard({ rail }: { rail: boolean }) {
  const router = useRouter();
  // The shell renders after mounting, so reading localStorage here is safe.
  const [user] = useState(getAdminUser);
  const name = user?.name || "Admin";
  const role = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Admin";

  const logOut = async () => {
    try {
      await logoutAdmin();
    } catch {
      // The server may be unreachable or reject the call; still end the local session.
    } finally {
      clearAdminSession();
      router.push("/login");
    }
  };

  if (rail) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Avatar name={name} size="sm" />
        <Tooltip label="Log Out" placement="right">
          <button
            type="button"
            onClick={logOut}
            aria-label="Log Out"
            className="flex size-10 items-center justify-center rounded-control text-sb-text transition-colors duration-150 ease-out hover:bg-white/10"
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="glass rounded-card p-3">
      <div className="flex items-center gap-3">
        <Avatar name={name} size="sm" />
        <div className="min-w-0">
          <p className="nav-group truncate text-sb-text">{name}</p>
          <p className="caption truncate text-sb-muted">{role}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={logOut}
        className={cn(
          "nav-group mt-3 flex h-10 w-full items-center gap-3 rounded-inset px-3 text-sb-text",
          "transition-colors duration-150 ease-out hover:bg-white/10",
        )}
      >
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
        Log Out
      </button>
    </div>
  );
}
