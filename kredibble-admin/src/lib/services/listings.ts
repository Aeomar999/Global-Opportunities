/**
 * Listings service: the curated (staff-made) listings of the Opportunities Queue.
 *
 * One function per need; pages never touch the store or the seed directly. Everything lives in the shared
 * in-memory mock store (mock-store.ts), so the list, the detail page, the form, the KPIs and the Overview see the
 * same listings.
 *
 * In real mode, reads and writes are connected to the live backend API (/admin/opportunities).
 * Local store updates are kept for optimistic feedback and backward-compatible synchronous returns.
 *
 * Rules kept here, not in the pages:
 * - Publishing needs a vetted listing; it sets status "published" and the published date.
 * - A published listing is always vetted (unvetting it, or unpublishing it, is handled by the callers).
 * - Vetting sets "vetted by" and "vetted on" together.
 */
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";
import type { Listing, ListingFormat, ListingMetrics, ListingType } from "@/lib/mock-entities";
import type { StaffMember } from "@/lib/mock-entities";
import { isMockMode } from "./mock-mode";
import {
  createOpportunityApi,
  getOpportunityById,
  getOpportunityMetricsApi,
  unpublishOpportunityApi,
  updateOpportunityApi,
  type OpportunityRecord,
} from "@/lib/api";

const MOCK_DELAY_MS = 300;
const afterDelay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));

/** Re-run a loader whenever listings (or anything else in the store) change. */
export const subscribeListings = subscribeMockStore;

/** Today as "YYYY-MM-DD" (local calendar day). */
export const todayIsoDate = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** Convert backend OpportunityRecord to frontend Listing. */
export function toListing(record: OpportunityRecord): Listing {
  return {
    id: record.id,
    title: record.title,
    organisation: record.organisation || record.company || record.offeringOrganization || "",
    type: (record.type as ListingType) || "job",
    country: record.country || "",
    status: (record.status === "published" || record.moderationStatus === "published") ? "published" : "draft",
    vetted: Boolean(record.vetted),
    createdAt: record.createdAt ? record.createdAt.slice(0, 10) : todayIsoDate(),
    publishedAt: record.publishedAt ? record.publishedAt.slice(0, 10) : undefined,
    closesAt: record.closesAt || (record.deadline ? record.deadline.slice(0, 10) : ""),
    description: record.description || "",
    applyUrl: record.applyUrl || record.applicationUrl || record.applicationLink || "",
    costLabel: record.costLabel,
    format: (record.format as ListingFormat) || "online",
    location: record.location,
    eventAt: record.eventAt || record.eventDateTime,
    durationLabel: record.durationLabel,
    logoUrl: record.logoUrl || record.organizationLogo,
    imageUrl: record.imageUrl || record.coverImage,
    writerId: record.writerId || record.assignedWriterId,
    referralOnApply: Boolean(record.referralOnApply || record.referralCodeOnApply),
    vettedById: record.vettedById || (record.vettedBy ? String(record.vettedBy) : undefined),
    vettedOn: record.vettedOn || (record.vettedAt ? record.vettedAt.slice(0, 10) : undefined),
  };
}

/** The fields a person fills in on the form. The rest (id, dates, status) is decided by the service. */
export type ListingFields = Omit<Listing, "id" | "createdAt" | "publishedAt" | "status">;

/** One listing, or undefined when the id is not a curated listing (it may be a hirer-submitted posting). */
export async function loadListing(id: string): Promise<Listing | undefined> {
  if (!isMockMode()) {
    try {
      const res = await getOpportunityById(id);
      if (res?.id) {
        const item = toListing(res);
        const existing = getMockCollection("listings");
        setMockCollection("listings", [item, ...existing.filter((l) => l.id !== item.id)], { always: true });
        return item;
      }
    } catch {
      // Fall through to mock store
    }
  }
  return afterDelay(getMockCollection("listings").find((listing) => listing.id === id));
}

/** The reach of one listing: views and applications, website versus app. Undefined when nothing was recorded. */
export async function loadListingMetrics(id: string): Promise<ListingMetrics | undefined> {
  if (!isMockMode()) {
    try {
      const res = await getOpportunityMetricsApi(id);
      if (res?.listingId) {
        const metrics: ListingMetrics = {
          listingId: id,
          views: res.views || { website: 0, app: 0 },
          applications: res.applications || { website: 0, app: 0 },
        };
        const existing = getMockCollection("listingMetrics");
        setMockCollection("listingMetrics", [metrics, ...existing.filter((m) => m.listingId !== id)], { always: true });
        return metrics;
      }
    } catch {
      // Fall through to mock store
    }
  }
  return Promise.resolve(getMockCollection("listingMetrics").find((metrics) => metrics.listingId === id));
}

/** Everyone who can be named as vetter or writer: active team members. */
export function listingStaff(): StaffMember[] {
  return getMockCollection("staff").filter((person) => person.status === "active");
}

/** The staff member who is signed in (the vetting default), or undefined when none is marked. */
export function currentStaffMember(): StaffMember | undefined {
  return getMockCollection("staff").find((person) => person.isCurrentUser);
}

export const staffName = (id: string | undefined): string | undefined =>
  id ? getMockCollection("staff").find((person) => person.id === id)?.name : undefined;

const write = (listings: Listing[]) => setMockCollection("listings", listings, { always: true });

/** Creates a listing as a draft, or published when `publish` is true (the form only allows that when vetted). */
export function createListing(fields: ListingFields, publish: boolean): Listing {
  const today = todayIsoDate();
  const tempId = `lst-new-${Date.now()}`;
  const listing: Listing = {
    ...fields,
    id: tempId,
    status: publish ? "published" : "draft",
    createdAt: today,
    publishedAt: publish ? today : undefined,
  };
  write([listing, ...getMockCollection("listings")]);
  if (publish) startMetrics(listing.id);

  if (!isMockMode()) {
    createOpportunityApi({
      title: fields.title,
      type: fields.type,
      company: fields.organisation,
      organisation: fields.organisation,
      location: fields.location || "Online",
      country: fields.country,
      description: fields.description,
      status: publish ? "published" : "draft",
      publish,
      vetted: fields.vetted,
      vettedById: fields.vettedById,
      vettedOn: fields.vettedOn,
      closesAt: fields.closesAt,
      applyUrl: fields.applyUrl,
      costLabel: fields.costLabel,
      durationLabel: fields.durationLabel,
      format: fields.format,
      eventAt: fields.eventAt,
      logoUrl: fields.logoUrl,
      imageUrl: fields.imageUrl,
      writerId: fields.writerId,
      referralOnApply: fields.referralOnApply,
    }).then((res) => {
      if (res?.id) {
        const realId = res.id;
        const mapped = toListing(res);
        const currentList = getMockCollection("listings");
        write(currentList.map((l) => (l.id === tempId ? mapped : l)));
        const metrics = getMockCollection("listingMetrics");
        setMockCollection(
          "listingMetrics",
          metrics.map((m) => (m.listingId === tempId ? { ...m, listingId: realId } : m)),
          { always: true },
        );
      }
    }).catch(() => {
      // Background persistence catch
    });
  }

  return listing;
}

/** Saves the form over an existing listing. `publish` moves a draft to published (and sets the published date). */
export function updateListing(id: string, fields: ListingFields, publish = false): Listing | undefined {
  const current = getMockCollection("listings").find((listing) => listing.id === id);
  if (!current) return undefined;
  const publishing = publish && current.status !== "published";
  const next: Listing = {
    ...current,
    ...fields,
    status: publish ? "published" : current.status,
    publishedAt: publishing ? todayIsoDate() : current.publishedAt,
  };
  write(getMockCollection("listings").map((listing) => (listing.id === id ? next : listing)));
  if (publishing) startMetrics(id);

  if (!isMockMode()) {
    updateOpportunityApi(id, {
      title: fields.title,
      type: fields.type,
      company: fields.organisation,
      organisation: fields.organisation,
      location: fields.location,
      country: fields.country,
      description: fields.description,
      status: publish ? "published" : current.status,
      publish,
      vetted: fields.vetted,
      vettedById: fields.vettedById,
      vettedOn: fields.vettedOn,
      closesAt: fields.closesAt,
      applyUrl: fields.applyUrl,
      costLabel: fields.costLabel,
      durationLabel: fields.durationLabel,
      format: fields.format,
      eventAt: fields.eventAt,
      logoUrl: fields.logoUrl,
      imageUrl: fields.imageUrl,
      writerId: fields.writerId,
      referralOnApply: fields.referralOnApply,
    }).catch(() => {
      // Background persistence catch
    });
  }

  return next;
}

/** Takes a published listing back to a draft (it stays vetted). */
export function unpublishListing(id: string) {
  write(
    getMockCollection("listings").map((listing) =>
      listing.id === id ? { ...listing, status: "draft" as const, publishedAt: undefined } : listing,
    ),
  );

  if (!isMockMode()) {
    unpublishOpportunityApi(id).catch(() => {
      // Background persistence catch
    });
  }
}

/** A newly published listing starts with no views and no applications (a known zero, not an unknown). */
function startMetrics(id: string) {
  const existing = getMockCollection("listingMetrics");
  if (existing.some((metrics) => metrics.listingId === id)) return;
  setMockCollection(
    "listingMetrics",
    [...existing, { listingId: id, views: { website: 0, app: 0 }, applications: { website: 0, app: 0 } }],
    { always: true },
  );
}
