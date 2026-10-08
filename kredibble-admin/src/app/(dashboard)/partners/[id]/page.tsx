"use client";

/**
 * Partner detail (/partners/[id]). Needs view access on partners. The dev ?state=loading|notfound|error switch works.
 */
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { PartnerDetail } from "@/components/partners/PartnerDetail";

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAccess screen="partners">
      <PartnerDetail id={id} />
    </RequireAccess>
  );
}
