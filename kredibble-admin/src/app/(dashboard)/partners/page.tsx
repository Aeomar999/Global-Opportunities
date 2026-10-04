"use client";

/**
 * Partners (/partners): placeholder, built in a later step. It is already in the nav and guarded by the
 * "partners" screen (src/config/permissions.ts).
 */
import { Handshake } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function PartnersPage() {
  return <StubPage screen="partners" title="Partners" subtitle="Organisations in the six-stage partner pipeline." icon={Handshake} tone="accent" />;
}
