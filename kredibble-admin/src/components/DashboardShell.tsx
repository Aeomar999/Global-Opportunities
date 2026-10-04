"use client";

/**
 * DashboardShell: the client half of the dashboard layout.
 * Session gate + sidebar + top bar + <main> + command palette.
 *
 * State it owns
 * - collapsed: the sidebar rail preference. The server layout reads the
 *   "sidebar" cookie and passes it as `initialSidebar`, so the first paint is
 *   already right (no flash). With no cookie the sidebar starts expanded and
 *   collapses once if the window is narrower than 1280px; that default is not
 *   saved, so only an explicit toggle writes the cookie.
 * - drawerOpen: the mobile drawer (below 1024px).
 * - paletteOpen: the Cmd/Ctrl+K command palette.
 *
 * Shortcuts: Ctrl/Cmd+B toggles the sidebar, Ctrl/Cmd+K opens the palette.
 * B is ignored while typing in a text field (it is "bold" there).
 *
 * Props:
 * - initialSidebar: "expanded" | "collapsed" from the cookie, or null when unset
 * - initialDevRoles: the dev role switcher's roles from its cookie (the RoleProvider ignores them in production)
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RoleProvider } from "@/components/access/RoleProvider";
import { RouteGuard } from "@/components/access/RouteGuard";
import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ToastProvider } from "@/components/ui/Toast";
import type { Role } from "@/config/roles";
import { SIDEBAR_COOKIE, type SidebarPreference } from "@/config/sidebar";
import { hasAdminSession } from "@/lib/api";
import { useMockStoreVersion } from "@/lib/mock-store";
import { getMockNavCounts } from "@/lib/services/mock-counts";
import { isMockMode } from "@/lib/services/mock-mode";
import { getNavCounts } from "@/lib/services/nav-counts";
import { useAsync } from "@/lib/use-async";

const AUTO_COLLAPSE_BELOW_PX = 1280;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

interface DashboardShellProps {
  initialSidebar: SidebarPreference | null;
  /** Roles from the dev switcher cookie (empty = none chosen). Ignored in production. */
  initialDevRoles: Role[];
  children: React.ReactNode;
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function DashboardShell({ initialSidebar, initialDevRoles, children }: DashboardShellProps) {
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    initialSidebar ? initialSidebar === "collapsed" : typeof window !== "undefined" && window.innerWidth < AUTO_COLLAPSE_BELOW_PX,
  );
  const { data: counts } = useAsync(getNavCounts);
  // Mock mode: the pills follow the shared mock store, so a decision on a detail page moves them at once.
  const storeVersion = useMockStoreVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mockCounts = useMemo(() => getMockNavCounts(), [storeVersion]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  }, [collapsed]);

  useEffect(() => {
    if (!hasAdminSession()) {
      router.replace("/login");
      return;
    }

    const timer = setTimeout(() => setIsCheckingSession(false), 0);
    return () => clearTimeout(timer);
  }, [router]);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (key === "b" && !isTyping(event.target)) {
        event.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-muted">
        Checking admin session...
      </div>
    );
  }

  const knownCounts = isMockMode() ? mockCounts : (counts ?? {});

  // The shell itself is the sidebar's dark colour, full height, so the notch at the content
  // panel's rounded top-left corner is seamless. The panel (right column) paints its own light
  // page background on top of it.
  // No min-h-screen on this wrapper: the body already fills the viewport (min-h-full flex-col),
  // so stacking another 100vh beside the top bar would only add blank height below the footer.
  return (
    <ToastProvider>
    <RoleProvider initialDevRoles={initialDevRoles}>
    <div className="flex flex-1 bg-sb-bg">
      {/* First tab stop: jumps past the sidebar to the page content. Visible only while focused. */}
      <a
        href="#main-content"
        className="button-text sr-only z-70 rounded-control bg-surface px-4 py-2 text-ink shadow-pop focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        drawerOpen={drawerOpen}
        onCloseDrawer={closeDrawer}
        counts={knownCounts}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {drawerOpen && <div aria-hidden="true" onClick={closeDrawer} className="fixed inset-0 z-30 bg-ink/40 lg:hidden" />}

      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <TopBar onOpenNav={() => setDrawerOpen(true)} counts={knownCounts} />
        {/* Page padding: 28px desktop, 20px tablet, 16px mobile. */}
        {/* flex column: a page can grow to fill the height (forms use it to pin their action bar to the bottom) */}
        <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col p-4 outline-none sm:p-5 lg:p-7">
          {/* Content is capped at 1440px and centred; the top bar above stays full width. */}
          <div className="mx-auto flex w-full max-w-page flex-1 flex-col">
            {/* Every nav route is checked against the roles here, so direct URL visits are guarded too. */}
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={closePalette} counts={knownCounts} />
    </div>
    </RoleProvider>
    </ToastProvider>
  );
}
