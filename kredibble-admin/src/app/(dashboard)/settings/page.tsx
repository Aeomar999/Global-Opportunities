"use client";

/**
 * Settings (/settings): placeholder, built in a later step. It is already in the nav and guarded by the
 * "settings" screen (src/config/permissions.ts).
 */
import { Settings } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function SettingsPage() {
  return <StubPage screen="settings" title="Settings" subtitle="Your own settings and, for admins, the desk's." icon={Settings} tone="neutral" />;
}
