"use client";

/**
 * Programs (/programs): placeholder, built in a later step. It is already in the nav and guarded by the
 * "programs" screen (src/config/permissions.ts).
 */
import { GraduationCap } from "lucide-react";
import { StubPage } from "@/components/access/StubPage";

export default function ProgramsPage() {
  return <StubPage screen="programs" title="Programs" subtitle="The desk's own activities: trainings, cohorts and campaigns." icon={GraduationCap} tone="brand" />;
}
