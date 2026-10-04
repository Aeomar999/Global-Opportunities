/**
 * THE one place that maps every status string used across the admin to a
 * visual tone and a label. StatusBadge reads this, so a status looks the same
 * on every list, detail page and card. Status is always shown as colour AND
 * text (a dot or icon plus the label).
 *
 *   success  Active, Verified, Published, Approved, Upcoming, Open (opportunities, grants)
 *   warning  Pending, Flagged, Open (reports), In review
 *   danger   Rejected, Suspended, Removed, Cancelled
 *   neutral  Draft, Past, Closed, Resolved, Dismissed
 *
 * "Open" is the one word that means two things: an open opportunity or grant is
 * good (success) but an open REPORT is waiting on a person (warning). Pass
 * kind="report" for reports; everything else uses the default.
 *
 * Unknown values fall back to "neutral" and display their raw text.
 */
export type StatusTone = "success" | "warning" | "danger" | "neutral";

/** Disambiguates words whose tone depends on what they describe. */
export type StatusKind = "report";

export interface StatusMeta {
  tone: StatusTone;
  label: string;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  // success
  active: { tone: "success", label: "Active" },
  verified: { tone: "success", label: "Verified" },
  published: { tone: "success", label: "Published" },
  approved: { tone: "success", label: "Approved" },
  upcoming: { tone: "success", label: "Upcoming" },
  open: { tone: "success", label: "Open" },
  // warning
  pending: { tone: "warning", label: "Pending" },
  flagged: { tone: "warning", label: "Flagged" },
  in_review: { tone: "warning", label: "In review" },
  // danger
  rejected: { tone: "danger", label: "Rejected" },
  suspended: { tone: "danger", label: "Suspended" },
  removed: { tone: "danger", label: "Removed" },
  cancelled: { tone: "danger", label: "Cancelled" },
  // neutral
  draft: { tone: "neutral", label: "Draft" },
  past: { tone: "neutral", label: "Past" },
  closed: { tone: "neutral", label: "Closed" },
  resolved: { tone: "neutral", label: "Resolved" },
  dismissed: { tone: "neutral", label: "Dismissed" },
};

const KIND_OVERRIDES: Record<StatusKind, Record<string, StatusMeta>> = {
  report: { open: { tone: "warning", label: "Open" } },
};

export const getStatusMeta = (status: string, kind?: StatusKind): StatusMeta => {
  const key = status.toLowerCase().replace(/[\s-]+/g, "_");
  return (kind && KIND_OVERRIDES[kind][key]) || STATUS_MAP[key] || { tone: "neutral", label: status };
};
