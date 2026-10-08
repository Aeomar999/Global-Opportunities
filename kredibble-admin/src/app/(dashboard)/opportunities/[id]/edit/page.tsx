"use client";

/**
 * Edit listing (/opportunities/[id]/edit): the same form, filled with a staff-curated listing. A hirer-submitted
 * posting (or an unknown id) shows "not found": those are reviewed on their detail page, not edited.
 * Needs EDIT access on listings_curate. The dev ?state=loading|error|notfound switch works here too.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { RequireAccess } from "@/components/access/RequireAccess";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { loadListing, subscribeListings } from "@/lib/services/listings";
import { useDetailData } from "@/lib/use-detail-data";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { ListingForm } from "@/components/opportunities/ListingForm";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadListing(id), [id]);
  const { status, record, error, retry } = useDetailData(load, { subscribe: subscribeListings });
  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.title : "Not found");

  return (
    <RequireAccess screen="listings_curate" level="edit">
      {status === "loading" ? (
        <DetailSkeleton />
      ) : status === "error" ? (
        <DetailError message={error ?? "Could not load this listing."} onRetry={retry} />
      ) : !record ? (
        <DetailNotFound noun="Listing" listLabel="Opportunities Queue" listHref="/opportunities" />
      ) : (
        // key: a different listing starts a fresh form
        <ListingForm key={record.id} listing={record} />
      )}
    </RequireAccess>
  );
}
