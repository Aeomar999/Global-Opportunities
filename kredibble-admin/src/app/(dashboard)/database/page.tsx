"use client";

/**
 * Database (/database): placeholder, built in a later step. It is already in the nav and guarded by the
 * "database" screen (src/config/permissions.ts).
 */
import { Database } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function DatabasePage() {
  return <StubPage screen="database" title="Database" subtitle="Beneficiary records kept by the desk." icon={Database} tone="neutral" />;
}
