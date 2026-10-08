"use client";

/**
 * Edit partner (/partners/[id]/edit): the same form, filled with the partner. Needs EDIT access on partners.
 * The dev ?state=loading|notfound|error switch works here too.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { loadPartner, subscribePartners } from "@/lib/services/partners";
import { useDetailData } from "@/lib/use-detail-data";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { PartnerForm } from "@/components/partners/PartnerForm";

export default function EditPartnerPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadPartner(id), [id]);
  const { status, record, error, retry } = useDetailData(load, { subscribe: subscribePartners });
  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.name : "Not found");

  return (
    <RequireAccess screen="partners" level="edit">
      {status === "loading" ? (
        <DetailSkeleton />
      ) : status === "error" ? (
        <DetailError message={error ?? "Could not load this partner."} onRetry={retry} />
      ) : !record ? (
        <DetailNotFound noun="Partner" listLabel="Partners" listHref="/partners" />
      ) : (
        // key: a different partner starts a fresh form
        <PartnerForm key={record.id} partner={record} />
      )}
    </RequireAccess>
  );
}
