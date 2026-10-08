"use client";

/**
 * Settings > Targets (/settings/targets). Needs EDIT access on "settings_admin" (Desk Lead and Super Admin); any other role sees the no-access
 * state. See components/settings/TargetsTab.tsx.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { TargetsTab } from "@/components/settings/TargetsTab";

export default function TargetsTabPage() {
  return (
    <RequireAccess screen="settings_admin" level="edit">
      <TargetsTab />
    </RequireAccess>
  );
}
