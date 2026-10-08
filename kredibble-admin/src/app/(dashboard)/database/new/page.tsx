"use client";

/**
 * Add record (/database/new). Needs EDIT access on database (Database Officer, Desk Lead, Super Admin); other roles see the
 * no-access state.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { RecordForm } from "@/components/database/RecordForm";

export default function NewRecordPage() {
  return (
    <RequireAccess screen="database" level="edit">
      <RecordForm />
    </RequireAccess>
  );
}
