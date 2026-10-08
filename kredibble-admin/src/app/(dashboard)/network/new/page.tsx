"use client";

/**
 * New ambassador (/network/new). Needs EDIT access on network (Country Lead, Desk Lead, Super Admin); other roles see the
 * no-access state. The referral code is made when the ambassador is saved; there is no field for it.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { AmbassadorForm } from "@/components/network/AmbassadorForm";

export default function NewAmbassadorPage() {
  return (
    <RequireAccess screen="network" level="edit">
      <AmbassadorForm />
    </RequireAccess>
  );
}
