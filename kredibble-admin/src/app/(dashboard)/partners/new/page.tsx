"use client";

/**
 * New partner (/partners/new). Needs EDIT access on partners (Partnerships Officer, Desk Lead, Super Admin); other roles
 * see the no-access state. A new partner always starts at Prospect.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { PartnerForm } from "@/components/partners/PartnerForm";

export default function NewPartnerPage() {
  return (
    <RequireAccess screen="partners" level="edit">
      <PartnerForm />
    </RequireAccess>
  );
}
