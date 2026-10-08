"use client";

/**
 * Settings > Integrations (/settings/integrations). Needs EDIT access on "settings_admin" (Desk Lead and Super Admin); any other role sees the no-access
 * state. See components/settings/IntegrationsTab.tsx.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";

export default function IntegrationsTabPage() {
  return (
    <RequireAccess screen="settings_admin" level="edit">
      <IntegrationsTab />
    </RequireAccess>
  );
}
