"use client";

/**
 * Ambassador detail (/network/[id]). Needs view access on network. The dev ?state=loading|notfound|error switch works.
 */
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { AmbassadorDetail } from "@/components/network/AmbassadorDetail";

export default function AmbassadorDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAccess screen="network">
      <AmbassadorDetail id={id} />
    </RequireAccess>
  );
}
