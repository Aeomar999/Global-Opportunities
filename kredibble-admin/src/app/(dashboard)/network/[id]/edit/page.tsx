"use client";

/**
 * Edit ambassador (/network/[id]/edit): the same form, filled with the ambassador. Needs EDIT access on network. The referral
 * code is shown read-only and is never changed by saving. The dev ?state=loading|notfound|error switch works here too.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { AmbassadorForm } from "@/components/network/AmbassadorForm";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { loadAmbassador, subscribeNetwork } from "@/lib/services/network";
import { useDetailData } from "@/lib/use-detail-data";

export default function EditAmbassadorPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadAmbassador(id), [id]);
  const { status, record, error, retry } = useDetailData(load, { subscribe: subscribeNetwork });
  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.ambassador.name : "Not found");

  return (
    <RequireAccess screen="network" level="edit">
      {status === "loading" ? (
        <DetailSkeleton />
      ) : status === "error" ? (
        <DetailError message={error ?? "Could not load this ambassador."} onRetry={retry} />
      ) : !record ? (
        <DetailNotFound noun="Ambassador" listLabel="Network" listHref="/network" />
      ) : (
        // key: a different ambassador starts a fresh form
        <AmbassadorForm key={record.ambassador.id} ambassador={record.ambassador} />
      )}
    </RequireAccess>
  );
}
