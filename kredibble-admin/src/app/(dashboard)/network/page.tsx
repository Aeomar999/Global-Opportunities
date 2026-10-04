"use client";

/**
 * Network (/network): placeholder, built in a later step. It is already in the nav and guarded by the
 * "network" screen (src/config/permissions.ts).
 */
import { Network } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function NetworkPage() {
  return <StubPage screen="network" title="Network" subtitle="Ambassadors who amplify listings with their referral code." icon={Network} tone="accent" />;
}
