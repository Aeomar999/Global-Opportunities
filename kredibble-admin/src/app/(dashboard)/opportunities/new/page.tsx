"use client";

/**
 * New listing (/opportunities/new): the form for a staff-curated listing. Needs EDIT access on listings_curate
 * (Opportunities Officer, Desk Lead, Super Admin); other roles see the no-access state.
 */
import { RequireAccess } from "@/components/access/RequireAccess";
import { ListingForm } from "@/components/opportunities/ListingForm";

export default function NewListingPage() {
  return (
    <RequireAccess screen="listings_curate" level="edit">
      <ListingForm />
    </RequireAccess>
  );
}
