"use client";

/**
 * Program detail (/programs/[id]). Needs view access on programs. The dev ?state=loading|notfound|error switch works.
 */
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { ProgramDetail } from "@/components/programs/ProgramDetail";

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAccess screen="programs">
      <ProgramDetail id={id} />
    </RequireAccess>
  );
}
