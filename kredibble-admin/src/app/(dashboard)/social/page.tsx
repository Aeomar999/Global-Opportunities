"use client";

/**
 * Social (/social): placeholder, built in a later step. It is already in the nav and guarded by the
 * "social" screen (src/config/permissions.ts).
 */
import { Share2 } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function SocialPage() {
  return <StubPage screen="social" title="Social" subtitle="Plan and publish the desk's social media posts." icon={Share2} tone="neutral" />;
}
