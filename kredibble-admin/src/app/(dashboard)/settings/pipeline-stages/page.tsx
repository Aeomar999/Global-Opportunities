"use client";

/**
 * Settings > Pipeline stages (/settings/pipeline-stages). Needs EDIT access on "settings_admin" (Desk Lead and Super Admin); any other role sees the no-access
 * state. See components/settings/StagesTab.tsx.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { StagesTab } from "@/components/settings/StagesTab";

export default function StagesTabPage() {
  return (
    <RequireAccess screen="settings_admin" level="edit">
      <StagesTab />
    </RequireAccess>
  );
}
