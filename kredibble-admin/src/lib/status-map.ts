/**
 * THE one place that maps every status string used across the admin to a
 * visual tone and a label. StatusBadge reads this, so a status looks the same
 * on every list, detail page and card. Status is always shown as colour AND
 * text (a dot or icon plus the label).
 *
 *   success  Active, Verified, Published, Approved, Upcoming, Open (opportunities, grants)
 *   warning  Pending, Flagged, Open (reports), In review
 *   danger   Rejected, Suspended, Removed, Cancelled
 *   neutral  Draft, Past, Closed, Resolved, Dismissed, Not submitted, Planned, Applicant, Unpublished
 *   info     Running (a program), Onboarding (an ambassador): in progress, nothing wrong, nothing finished (purple)
 *
 * Desk statuses (programs, ambassadors, testimonials, listings):
 *   partner      prospect = neutral, outreach / proposal / mou = info (in progress), onboard / renew = success (closed)
 *   program      planned = neutral, running = info, delivered = success, cancelled = danger
 *   ambassador   applicant = neutral, onboarding = info, active = success, dormant = warning
 *   database     verified = success, pending = warning
 *   testimonial  pending = warning, approved = success, unpublished = neutral, rejected = danger
 *   listing      draft = neutral, published = success
 *   vetting      unvetted = warning, vetted = success
 *   pipeline     healthy = success, thin = warning, critical = danger, unknown ("Not enough data") = neutral
 *   pace         on_pace = success, behind = warning, far_behind = danger (the Database verification pace, from kpiStatus). They read
 *                "On track / Behind / Off track" (KPI_STATUS_LABELS): the gauge ZONES have their own words.
 *
 * "Open" is the one word that means two things: an open opportunity or grant is
 * good (success) but an open REPORT is waiting on a person (warning). Pass
 * kind="report" for reports; everything else uses the default.
 *
 * Unknown values fall back to "neutral" and display their raw text.
 */
export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

/** Disambiguates words whose tone depends on what they describe. */
export type StatusKind = "report";

export interface StatusMeta {
  tone: StatusTone;
  label: string;
}

/**
 * THE words for a KPI status, used everywhere a target is judged: the Overview cards, the Database pace chip, the Settings example and
 * every aria text. (The Database gauge's three ZONES keep their own words, "Far behind / Behind / On pace".)
 */
export const KPI_STATUS_LABELS = { green: "On track", amber: "Behind", red: "Off track" } as const;

const STATUS_MAP: Record<string, StatusMeta> = {
  // success
  active: { tone: "success", label: "Active" },
  verified: { tone: "success", label: "Verified" },
  published: { tone: "success", label: "Published" },
  approved: { tone: "success", label: "Approved" },
  upcoming: { tone: "success", label: "Upcoming" },
  delivered: { tone: "success", label: "Delivered" },
  onboard: { tone: "success", label: "Onboard" },
  renew: { tone: "success", label: "Renew" },
  vetted: { tone: "success", label: "Vetted" },
  healthy: { tone: "success", label: "Healthy" },
  on_pace: { tone: "success", label: KPI_STATUS_LABELS.green },
  open: { tone: "success", label: "Open" },
  // info
  running: { tone: "info", label: "Running" },
  outreach: { tone: "info", label: "Outreach" },
  proposal: { tone: "info", label: "Proposal" },
  mou: { tone: "info", label: "MOU" },
  onboarding: { tone: "info", label: "Onboarding" },
  // warning
  dormant: { tone: "warning", label: "Dormant" },
  unvetted: { tone: "warning", label: "Unvetted" },
  thin: { tone: "warning", label: "Thin" },
  behind: { tone: "warning", label: KPI_STATUS_LABELS.amber },
  pending: { tone: "warning", label: "Pending" },
  flagged: { tone: "warning", label: "Flagged" },
  in_review: { tone: "warning", label: "In review" },
  // danger
  rejected: { tone: "danger", label: "Rejected" },
  critical: { tone: "danger", label: "Critical" },
  far_behind: { tone: "danger", label: KPI_STATUS_LABELS.red },
  suspended: { tone: "danger", label: "Suspended" },
  removed: { tone: "danger", label: "Removed" },
  cancelled: { tone: "danger", label: "Cancelled" },
  // neutral
  planned: { tone: "neutral", label: "Planned" },
  prospect: { tone: "neutral", label: "Prospect" },
  applicant: { tone: "neutral", label: "Applicant" },
  unpublished: { tone: "neutral", label: "Unpublished" },
  draft: { tone: "neutral", label: "Draft" },
  past: { tone: "neutral", label: "Past" },
  closed: { tone: "neutral", label: "Closed" },
  resolved: { tone: "neutral", label: "Resolved" },
  dismissed: { tone: "neutral", label: "Dismissed" },
  not_submitted: { tone: "neutral", label: "Not submitted" },
  unknown: { tone: "neutral", label: "Not enough data" },
};

const KIND_OVERRIDES: Record<StatusKind, Record<string, StatusMeta>> = {
  report: { open: { tone: "warning", label: "Open" } },
};

export const getStatusMeta = (status: string, kind?: StatusKind): StatusMeta => {
  const key = status.toLowerCase().replace(/[\s-]+/g, "_");
  return (kind && KIND_OVERRIDES[kind][key]) || STATUS_MAP[key] || { tone: "neutral", label: status };
};
