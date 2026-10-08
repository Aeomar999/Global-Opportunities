/**
 * Listings service: the curated (staff-made) listings of the Opportunities Queue.
 *
 * One function per need; pages never touch the store or the seed directly. Everything lives in the shared
 * in-memory mock store (mock-store.ts), so the list, the detail page, the form, the KPIs and the Overview see the
 * same listings. Writes use `{ always: true }`: curated listings have no backend yet, so they are kept in memory in
 * every mode (a reload resets them).
 * TODO(backend): every write below must be persisted by the API.
 *
 * Rules kept here, not in the pages:
 * - Publishing needs a vetted listing; it sets status "published" and the published date.
 * - A published listing is always vetted (unvetting it, or unpublishing it, is handled by the callers).
 * - Vetting sets "vetted by" and "vetted on" together.
 */
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";
import type { Listing, ListingMetrics } from "@/lib/mock-entities";
import type { StaffMember } from "@/lib/mock-entities";

const MOCK_DELAY_MS = 300;
const afterDelay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));

/** Re-run a loader whenever listings (or anything else in the store) change. */
export const subscribeListings = subscribeMockStore;

/** Today as "YYYY-MM-DD" (local calendar day). */
export const todayIsoDate = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** The fields a person fills in on the form. The rest (id, dates, status) is decided by the service. */
export type ListingFields = Omit<Listing, "id" | "createdAt" | "publishedAt" | "status">;

/** One listing, or undefined when the id is not a curated listing (it may be a hirer-submitted posting). */
export function loadListing(id: string): Promise<Listing | undefined> {
  return afterDelay(getMockCollection("listings").find((listing) => listing.id === id));
}

/** The reach of one listing: views and applications, website versus app. Undefined when nothing was recorded. */
export function loadListingMetrics(id: string): Promise<ListingMetrics | undefined> {
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
  const listing: Listing = {
    ...fields,
    id: `lst-new-${Date.now()}`,
    status: publish ? "published" : "draft",
    createdAt: today,
    publishedAt: publish ? today : undefined,
  };
  write([listing, ...getMockCollection("listings")]);
  if (publish) startMetrics(listing.id);
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
  return next;
}

/** Takes a published listing back to a draft (it stays vetted). */
export function unpublishListing(id: string) {
  write(
    getMockCollection("listings").map((listing) =>
      listing.id === id ? { ...listing, status: "draft" as const, publishedAt: undefined } : listing,
    ),
  );
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
