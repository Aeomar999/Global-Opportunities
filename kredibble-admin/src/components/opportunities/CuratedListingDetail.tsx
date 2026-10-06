"use client";

/**
 * CuratedListingDetail: the detail page of a STAFF-CURATED listing (hirer-submitted postings keep their own approve /
 * reject page, see /opportunities/[id]). Built on the shared detail template.
 *
 * - Header: type tile and pill, title, badges (status, vetting) and a "Staff-curated" source pill, the organisation
 *   and place; the Edit button (needs edit access on listings_curate; otherwise it is disabled with a tooltip).
 * - Main: Description, Vetting (who and when), and for PUBLISHED listings the Reach card (views and applications, each
 *   split into website and app).
 * - Side: Details (type, country, format, location, deadline, cost, event date, duration, writer, referral code,
 *   dates).
 * - Danger zone (published listings, edit access): Unpublish, with a confirm dialog. It returns the listing to a
 *   draft; it stays vetted.
 * Data: services/listings.ts (shared mock store), live through the store's subscription. Each action carries a
 * TODO(backend).
 *
 * Props: id (the listing id)
 */
import Link from "next/link";
import { useCallback } from "react";
import { Award, Briefcase, CalendarDays, EyeOff, GraduationCap, HandCoins, Pencil, Sparkles, type LucideIcon } from "lucide-react";
import { useRoles, VIEW_ONLY_TOOLTIP } from "@/components/access/RoleProvider";
import { formatDate, formatDateTime } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import type { Listing, ListingMetrics, ListingType } from "@/lib/mock-entities";
import { loadListing, loadListingMetrics, staffName, subscribeListings, unpublishListing } from "@/lib/services/listings";
import { useDetailData } from "@/lib/use-detail-data";
import { DangerZone } from "@/components/detail/DangerZone";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ReachCard } from "./ReachCard";

const TYPE_META: Record<ListingType, { label: string; icon: LucideIcon }> = {
  job: { label: "Job", icon: Briefcase },
  internship: { label: "Internship", icon: GraduationCap },
  event: { label: "Event", icon: CalendarDays },
  grant: { label: "Grant", icon: HandCoins },
  scholarship: { label: "Scholarship", icon: Award },
  fellowship: { label: "Fellowship", icon: Sparkles },
};
const FORMAT_LABEL = { online: "Online", "in-person": "In person", hybrid: "Hybrid" } as const;

interface Loaded {
  listing: Listing;
  metrics?: ListingMetrics;
}

export function CuratedListingDetail({ id }: { id: string }) {
  const { can } = useRoles();
  const canEdit = can("listings_curate", "edit");
  const load = useCallback(async (): Promise<Loaded | undefined> => {
    const listing = await loadListing(id);
    return listing ? { listing, metrics: await loadListingMetrics(id) } : undefined;
  }, [id]);
  const { status, record, error, retry } = useDetailData(load, { subscribe: subscribeListings });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.listing.title : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this listing."} onRetry={retry} />;
  if (!record) return <DetailNotFound noun="Opportunity" listLabel="Opportunities Queue" listHref="/opportunities" />;

  const { listing, metrics } = record;
  const type = TYPE_META[listing.type];
  const published = listing.status === "published";

  const unpublish = () =>
    confirm({
      title: "Unpublish this listing?",
      description: (
        <>
          <strong className="text-ink">{listing.title}</strong> will no longer be visible to seekers. It goes back to Draft and stays vetted,
          so you can publish it again.
        </>
      ),
      confirmLabel: "Unpublish listing",
      onConfirm: () => {
        // TODO(backend): persist this change
        unpublishListing(listing.id);
        toast.success(`${listing.title} was unpublished.`);
      },
    });

  const editButton = canEdit ? (
    <Link href={`/opportunities/${listing.id}/edit`} className={buttonClasses("secondary")}>
      <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
      Edit
    </Link>
  ) : (
    <Tooltip label={VIEW_ONLY_TOOLTIP}>
      <Button variant="secondary" icon={Pencil} disabled>
        Edit
      </Button>
    </Tooltip>
  );

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: type.icon }}
            eyebrow={
              <span className="flex flex-wrap items-center gap-2">
                <TagPill icon={type.icon}>{type.label}</TagPill>
                <span data-testid="source-pill">
                  <TagPill>Staff-curated</TagPill>
                </span>
              </span>
            }
            title={listing.title}
            badges={
              <span className="flex flex-wrap items-center gap-2">
                <StatusBadge status={listing.status} />
                <span data-testid="vetting-badge">
                  <StatusBadge status={listing.vetted ? "vetted" : "unvetted"} />
                </span>
              </span>
            }
            meta={`${listing.organisation} · ${listing.location ?? listing.country}`}
            actions={editButton}
          />
        }
        main={
          <>
            <InfoCard title="Description">
              <p className="input-text whitespace-pre-line text-ink">{listing.description}</p>
            </InfoCard>

            <InfoCard title="Vetting">
              {listing.vetted ? (
                <KeyValueList
                  items={[
                    { label: "Vetted by", value: staffName(listing.vettedById) },
                    { label: "Vetted on", value: listing.vettedOn ? formatDate(listing.vettedOn) : undefined },
                  ]}
                />
              ) : (
                <p className="input-text text-ink">Not vetted yet. Listings must be vetted before they can be published.</p>
              )}
            </InfoCard>

            {published && (metrics ? <ReachCard views={metrics.views} applications={metrics.applications} /> : (
              <InfoCard title="Reach">
                <p className="input-text text-muted">No views or applications have been recorded yet. —</p>
              </InfoCard>
            ))}
          </>
        }
        side={
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Type", value: type.label },
                { label: "Country", value: listing.country },
                { label: "Format", value: FORMAT_LABEL[listing.format] },
                { label: "Location", value: listing.location },
                { label: "Deadline", value: formatDate(listing.closesAt) },
                { label: "Cost or fee", value: listing.costLabel },
                { label: "Event date", value: listing.eventAt ? formatDateTime(listing.eventAt) : undefined },
                { label: "Duration", value: listing.durationLabel },
                { label: "Writer", value: staffName(listing.writerId) },
                { label: "Referral code on apply", value: listing.referralOnApply ? "On" : "Off" },
                { label: "Apply link", value: listing.applyUrl },
                { label: "Created", value: formatDate(listing.createdAt) },
                { label: "Published", value: listing.publishedAt ? formatDate(listing.publishedAt) : undefined },
              ]}
            />
          </InfoCard>
        }
        danger={
          published && canEdit ? (
            <DangerZone explanation="Removes this listing from what seekers see and returns it to Draft. It stays vetted, so you can publish it again.">
              <Button variant="danger" icon={EyeOff} onClick={unpublish}>
                Unpublish listing
              </Button>
            </DangerZone>
          ) : undefined
        }
      />
      {dialog}
    </>
  );
}
