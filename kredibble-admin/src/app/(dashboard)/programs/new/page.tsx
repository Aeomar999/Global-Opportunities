"use client";

/**
 * New program (/programs/new). Needs EDIT access on programs (Training Officer, Desk Lead, Super Admin); other roles
 * see the no-access state.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { ProgramForm } from "@/components/programs/ProgramForm";

export default function NewProgramPage() {
  return (
    <RequireAccess screen="programs" level="edit">
      <ProgramForm />
    </RequireAccess>
  );
}
