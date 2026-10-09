/**
 * Testimonials service: the moderation queue of stories sent in by seekers, hirers and partners. One function per need; pages
 * never touch the store or the seed. Everything lives in the shared in-memory mock store, so the tab counts, the sidebar pill
 * and (later) the Overview attention card read the same list. Writes use `{ always: true }`.
 * TODO(backend): every write below must be persisted by the API.
 *
 * Rules kept here, not in the page:
 * - ACTIONS by status: a pending item can be approved or rejected; an approved item can be unpublished; an unpublished or a
 *   rejected item can be re-approved. Nothing else moves an item (setTestimonialStatus refuses any other move).
 * - The EMAIL is staff-only. publicPreview() is what the public sees (name, comment and a photo placeholder): it has no email
 *   field at all, so the preview cannot show one.
 */
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";
import { TESTIMONIAL_STATUSES, type Testimonial, type TestimonialStatus } from "@/lib/mock-entities";
import { isMockMode } from "./mock-mode";
import { getTestimonialsApi, moderateTestimonialApi } from "@/lib/api";

const MOCK_DELAY_MS = 300;
let loadedOnce = false;
const afterDelay = <T>(value: T) => {
  if (loadedOnce) return Promise.resolve(value);
  return new Promise<T>((resolve) =>
    setTimeout(() => {
      loadedOnce = true;
      resolve(value);
    }, MOCK_DELAY_MS),
  );
};

/** Re-run a loader whenever the testimonials (or anything else in the store) change. */
export const subscribeTestimonials = subscribeMockStore;

export type TestimonialAction = "approve" | "reject" | "unpublish" | "reapprove";

/** The actions each status offers, and where each one leads. */
export const ACTIONS_BY_STATUS: Record<TestimonialStatus, TestimonialAction[]> = {
  pending: ["approve", "reject"],
  approved: ["unpublish"],
  unpublished: ["reapprove"],
  rejected: ["reapprove"],
};
export const ACTION_RESULT: Record<TestimonialAction, TestimonialStatus> = { approve: "approved", reject: "rejected", unpublish: "unpublished", reapprove: "approved" };

/** How many items are in each status. */
export function testimonialCounts(list: readonly Pick<Testimonial, "status">[]): Record<TestimonialStatus, number> {
  const counts = Object.fromEntries(TESTIMONIAL_STATUSES.map((status) => [status, 0])) as Record<TestimonialStatus, number>;
  for (const item of list) counts[item.status] += 1;
  return counts;
}

/** What the public sees of an approved item: the name, the comment and a photo placeholder (initials). NEVER the email. */
export const publicPreview = (item: Pick<Testimonial, "author" | "quote">): { name: string; comment: string } => ({ name: item.author, comment: item.quote });

/** Newest first. */
export const sortTestimonials = (list: readonly Testimonial[]): Testimonial[] => [...list].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.id.localeCompare(a.id));

export async function loadTestimonials(): Promise<Testimonial[]> {
  if (!isMockMode()) {
    try {
      const res = await getTestimonialsApi({ limit: 100 });
      if (res?.data && Array.isArray(res.data)) {
        const mapped: Testimonial[] = res.data.map((record) => ({
          id: record.id,
          author: record.author || record.name,
          email: record.email,
          role: record.role || "",
          quote: record.quote || record.comment,
          status: record.status as TestimonialStatus,
          submittedAt: record.submittedAt,
        }));
        setMockCollection("testimonials", mapped, { always: true });
        return sortTestimonials(mapped);
      }
    } catch {
      // Fall back to local mock collection on API error
    }
  }
  return afterDelay(sortTestimonials(getMockCollection("testimonials")));
}

/** Moves an item with one of its actions. Returns the updated item, or undefined when the item is missing or the action is not offered. */
export function applyTestimonialAction(id: string, action: TestimonialAction): Testimonial | undefined {
  const list = getMockCollection("testimonials");
  const current = list.find((item) => item.id === id);
  if (!current || !ACTIONS_BY_STATUS[current.status].includes(action)) return undefined;
  const next: Testimonial = { ...current, status: ACTION_RESULT[action] };
  setMockCollection("testimonials", list.map((item) => (item.id === id ? next : item)), { always: true });

  if (!isMockMode()) {
    moderateTestimonialApi(id, { action }).catch(() => {
      // Background persistence catch
    });
  }

  return next;
}
