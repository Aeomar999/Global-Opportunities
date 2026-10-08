"use client";

/**
 * Settings layout: the frame (title, the tabs for admins) around the four Settings pages. See components/settings/SettingsShell.tsx.
 */
import type { ReactNode } from "react";
import { RequireAccess } from "@/components/access/RequireAccess";
import { SettingsShell } from "@/components/settings/SettingsShell";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAccess screen="settings">
      <SettingsShell>{children}</SettingsShell>
    </RequireAccess>
  );
}
