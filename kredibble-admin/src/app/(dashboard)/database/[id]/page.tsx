"use client";

/**
 * Record detail (/database/[id]). Needs view access on database. The dev ?state=loading|notfound|error switch works.
 */
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { RecordDetail } from "@/components/database/RecordDetail";

export default function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAccess screen="database">
      <RecordDetail id={id} />
    </RequireAccess>
  );
}
