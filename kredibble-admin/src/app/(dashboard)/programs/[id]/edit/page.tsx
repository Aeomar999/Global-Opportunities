"use client";

/**
 * Edit program (/programs/[id]/edit): the same form, filled with the program. Needs EDIT access on programs.
 * The dev ?state=loading|notfound|error switch works here too.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { loadProgram, subscribeProgramStore } from "@/lib/services/programs";
import { useDetailData } from "@/lib/use-detail-data";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { ProgramForm } from "@/components/programs/ProgramForm";

export default function EditProgramPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadProgram(id), [id]);
  const { status, record, error, retry } = useDetailData(load, { subscribe: subscribeProgramStore });
  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.name : "Not found");

  return (
    <RequireAccess screen="programs" level="edit">
      {status === "loading" ? (
        <DetailSkeleton />
      ) : status === "error" ? (
        <DetailError message={error ?? "Could not load this program."} onRetry={retry} />
      ) : !record ? (
        <DetailNotFound noun="Program" listLabel="Programs" listHref="/programs" />
      ) : (
        // key: a different program starts a fresh form
        <ProgramForm key={record.id} program={record} />
      )}
    </RequireAccess>
  );
}
