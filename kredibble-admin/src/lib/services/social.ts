/**
 * Social service: the posts the desk logs by hand (there is no live platform API), the monthly totals worked out from them, and
 * the list of a month's posts. One function per need; pages never touch the store or the seed. Everything lives in the shared
 * in-memory mock store, so the totals on /social, the "Posts published", "Social reach" and "Social engagement" KPIs
 * (lib/kpi.ts counts published posts by the month of postedAt) always agree. Writes use `{ always: true }`.
 * TODO(backend): every write below must be persisted by the API.
 *
 * Rules kept here, not in the page:
 * - TOTALS always come from dated posts: a published post counts in the month of its date. So a post dated in an earlier month
 *   changes THAT month's totals, and past months are otherwise read-only (nothing here edits or deletes a post).
 * - The three team-wide totals are kpiValue() (the same function as the KPIs); the platform rows are summed from the same posts,
 *   so they always add up to the totals.
 * - A new post is always published, dated by the person (never in the future, default today), authored by the signed-in staff
 *   member, and linked to a published opportunity only when one is chosen.
 * - The LEADING platform is the one with the most reach in the month (ties: more posts, then the name).
 */
import { currentMonth, kpiTarget, kpiValue, storeData } from "@/lib/kpi";
import { getMockCollection, setMockCollection, subscribeMockStore } from "@/lib/mock-store";
import { POST_PLATFORM_LABELS, SOCIAL_POST_PLATFORMS, type MonthKey, type PostPlatform, type SocialPost } from "@/lib/mock-entities";
import { currentStaffMember, todayIsoDate } from "@/lib/services/listings";
import { isMockMode } from "./mock-mode";
import {
  getSocialPostsApi,
  getSocialMonthlyTotalsApi,
  createSocialPostApi,
  type PlatformRowApiRecord,
} from "@/lib/api";

const MOCK_DELAY_MS = 300;
// The first load of a page takes a moment (a skeleton shows). Every later read is instant, so a change is on screen at once.
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

/** Re-run a loader whenever the posts (or anything else in the store) change. */
export const subscribeSocial = subscribeMockStore;

const monthOf = (iso: string): MonthKey => iso.slice(0, 7);

// ---- pure rules (tested on their own) ---------------------------------------------------------------------------------

/** The posts that count in a month: published, dated in it. */
export const publishedIn = <T extends Pick<SocialPost, "status" | "postedAt">>(posts: readonly T[], month: MonthKey): T[] =>
  posts.filter((post) => post.status === "published" && monthOf(post.postedAt) === month);

export interface PlatformRow {
  platform: PostPlatform;
  label: string;
  posts: number;
  reach: number;
  engagement: number;
}

/** Posts, reach and engagement of each platform that has a post in the month, the leading platform first. */
export function platformRows(posts: readonly Pick<SocialPost, "platform" | "status" | "postedAt" | "reach" | "engagement">[], month: MonthKey): PlatformRow[] {
  const rows = SOCIAL_POST_PLATFORMS.map((platform): PlatformRow => {
    const mine = publishedIn(posts, month).filter((post) => post.platform === platform);
    return {
      platform,
      label: POST_PLATFORM_LABELS[platform],
      posts: mine.length,
      reach: mine.reduce((sum, post) => sum + post.reach, 0),
      engagement: mine.reduce((sum, post) => sum + post.engagement, 0),
    };
  }).filter((row) => row.posts > 0);
  return rows.sort((a, b) => b.reach - a.reach || b.posts - a.posts || a.label.localeCompare(b.label));
}

/** Is this a usable link to a post: http or https, with a real host (a dot, no spaces)? Returns the message, or undefined when fine. */
export function validatePostUrl(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "Enter the link to the post.";
  if (/\s/.test(text)) return "A link cannot contain spaces.";
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return "Enter a full link, like https://www.instagram.com/p/abc123.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "The link must start with https:// or http://.";
  if (!url.hostname.includes(".") || url.hostname.startsWith(".") || url.hostname.endsWith(".")) return "Enter a full link, like https://www.instagram.com/p/abc123.";
  return undefined;
}

/** The Log a post form's values (strings, as typed). */
export interface PostFormState {
  platform: PostPlatform | "";
  title: string;
  url: string;
  reach: string;
  engagement: string;
  listingId: string;
  postedAt: string;
}

type PostErrors = Partial<Record<"platform" | "title" | "url" | "reach" | "engagement" | "postedAt", string>>;
const isWholeNumber = (value: string) => /^\d+$/.test(value.trim());

/** The rules of the Log a post form. `today` is "YYYY-MM-DD": a later date is refused. */
export function validatePost(form: PostFormState, today: string): PostErrors {
  const errors: PostErrors = {};
  if (!form.platform) errors.platform = "Choose the platform.";
  if (!form.title.trim()) errors.title = "Enter the post title.";
  const urlError = validatePostUrl(form.url);
  if (urlError) errors.url = urlError;
  if (!form.reach.trim()) errors.reach = "Enter the reach (0 if unknown).";
  else if (!isWholeNumber(form.reach)) errors.reach = "Reach is a whole number, 0 or more.";
  if (!form.engagement.trim()) errors.engagement = "Enter the engagement (0 if none).";
  else if (!isWholeNumber(form.engagement)) errors.engagement = "Engagement is a whole number, 0 or more.";
  if (!form.postedAt) errors.postedAt = "Choose the date it was posted.";
  else if (form.postedAt > today) errors.postedAt = "The date posted cannot be in the future.";
  return errors;
}

// ---- reads ------------------------------------------------------------------------------------------------------------

export interface SocialMonth {
  month: MonthKey;
  posts: number;
  reach: number;
  engagement: number;
  /** The month's targets (kpiTarget), for the captions. */
  targets: { posts: number; reach: number; engagement: number };
  platforms: PlatformRow[];
  /** The platform with the most reach, or null when the month has no post. */
  leading: PostPlatform | null;
}

/** The totals of one month. `data` is for the tests. */
export function socialMonth(month: MonthKey, data = storeData()): SocialMonth {
  const platforms = platformRows(data.socialPosts, month);
  return {
    month,
    posts: kpiValue("posts_published", month, data),
    reach: kpiValue("social_reach", month, data),
    engagement: kpiValue("social_engagement", month, data),
    targets: { posts: kpiTarget("posts_published", data, month), reach: kpiTarget("social_reach", data, month), engagement: kpiTarget("social_engagement", data, month) },
    platforms,
    leading: platforms[0]?.platform ?? null,
  };
}

export async function loadMonthSocialTotals(month: MonthKey): Promise<SocialMonth> {
  if (!isMockMode()) {
    try {
      const res = await getSocialMonthlyTotalsApi(month);
      if (res && typeof res.posts === 'number') {
        return {
          month: res.month as MonthKey,
          posts: res.posts,
          reach: res.reach,
          engagement: res.engagement,
          targets: res.targets,
          platforms: (res.platforms || []).map((p: PlatformRowApiRecord) => ({
            platform: p.platform as PostPlatform,
            label: p.label,
            posts: p.posts,
            reach: p.reach,
            engagement: p.engagement,
          })),
          leading: (res.leading as PostPlatform) || null,
        };
      }
    } catch {
      // Fallback to local calculation
    }
  }
  return socialMonth(month);
}

/** A post with the name of the opportunity it promotes. */
export interface PostRow extends SocialPost {
  listingTitle?: string;
}

const withTitle = (post: SocialPost): PostRow => ({
  ...post,
  listingTitle: post.listingId ? getMockCollection("listings").find((listing) => listing.id === post.listingId)?.title : undefined,
});

/** The month's published posts with their opportunity names, newest first (the list follows the live store). */
export const toPostRows = (posts: readonly SocialPost[], month: MonthKey): PostRow[] =>
  publishedIn(posts, month)
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt) || b.id.localeCompare(a.id))
    .map(withTitle);

export async function loadMonthPosts(month: MonthKey): Promise<PostRow[]> {
  if (!isMockMode()) {
    try {
      const res = await getSocialPostsApi({ month });
      if (res.data && Array.isArray(res.data)) {
        return res.data.map((record) => ({
          id: record.id,
          platform: record.platform as PostPlatform,
          title: record.title,
          url: record.url,
          listingId: record.listingId,
          listingTitle: record.listingTitle,
          text: record.text || record.title,
          status: record.status,
          postedAt: record.postedAt,
          reach: record.reach,
          engagement: record.engagement,
          authorId: record.authorId || record.createdBy || "",
        }));
      }
    } catch {
      // Fallback to local mock collection on API error
    }
  }
  return afterDelay(toPostRows(getMockCollection("socialPosts"), month));
}

/** Opportunities a post can promote: the published ones. */
export const opportunityOptions = (): { id: string; title: string; organisation: string }[] =>
  getMockCollection("listings")
    .filter((listing) => listing.status === "published")
    .map((listing) => ({ id: listing.id, title: listing.title, organisation: listing.organisation }))
    .sort((a, b) => a.title.localeCompare(b.title));

export { currentMonth };

// ---- writes -----------------------------------------------------------------------------------------------------------

/** What the form edits. The id, the status and the author are decided here. */
export interface PostFields {
  platform: PostPlatform;
  title: string;
  url: string;
  reach: number;
  engagement: number;
  listingId?: string;
  /** "YYYY-MM-DD", today or earlier. */
  postedAt: string;
}

export type LogResult = { ok: true; post: SocialPost } | { ok: false; error: string };

/** Logs a published post. A date in the future is refused (nothing is written). */
export function logPost(fields: PostFields): LogResult {
  if (fields.postedAt > todayIsoDate()) return { ok: false, error: "The date posted cannot be in the future." };
  const existing = getMockCollection("socialPosts");
  const post: SocialPost = {
    id: `soc-new-${Date.now()}-${existing.length}`,
    platform: fields.platform,
    title: fields.title.trim(),
    url: fields.url.trim(),
    listingId: fields.listingId || undefined,
    text: fields.title.trim(),
    status: "published",
    postedAt: fields.postedAt,
    reach: Math.max(0, Math.round(fields.reach)),
    engagement: Math.max(0, Math.round(fields.engagement)),
    authorId: currentStaffMember()?.id ?? existing[0]?.authorId ?? "",
  };
  setMockCollection("socialPosts", [post, ...existing], { always: true });

  if (!isMockMode()) {
    createSocialPostApi({
      platform: fields.platform,
      title: fields.title.trim(),
      url: fields.url.trim(),
      reach: Math.max(0, Math.round(fields.reach)),
      engagement: Math.max(0, Math.round(fields.engagement)),
      postedAt: fields.postedAt,
      listingId: fields.listingId || undefined,
      status: "published",
    }).catch(() => {
      // Background persistence catch
    });
  }

  return { ok: true, post };
}
