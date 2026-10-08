"use client";

/**
 * Testimonials (/testimonials): the moderation queue for stories sent in by seekers, hirers and partners. Needs view access on
 * "testimonials".
 *
 * - Tabs with counts: Pending, Approved, Unpublished, Rejected (the Tabs component). Each tab keeps its own count; a move between
 *   tabs changes both counts and the Pending pill on the sidebar item in the same render (all read the one store).
 * - Each item is a TestimonialCard: initials avatar, name, the comment, the submitted date, the status badge and, for a role that
 *   can edit, the email on a "Staff only" line with a lock icon. An approved item also shows its "Public preview" (name, comment
 *   and photo only: never the email).
 * - Actions (only for a role that can edit testimonials: the Communications Officer, Desk Lead and Super Admin; every other role
 *   sees no action and no email, they are not rendered): Approve and Reject on pending, Unpublish on approved, Re-approve on
 *   unpublished and rejected. Reject and Unpublish ask first (ConfirmDialog); every action shows a toast.
 * Outside mock mode a notice says the page shows sample data. The dev ?state=loading|empty|error switch works.
 */
import { useMemo, useState } from "react";
import { Quote } from "lucide-react";
import { RequireAccess } from "@/components/access/RequireAccess";
import { useRoles } from "@/components/access/RoleProvider";
import { ListPage } from "@/components/list/ListPage";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs, tabId, tabPanelId } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { TESTIMONIAL_STATUSES, type Testimonial, type TestimonialStatus } from "@/lib/mock-entities";
import { useMockCollection } from "@/lib/mock-store";
import { applyTestimonialAction, loadTestimonials, sortTestimonials, subscribeTestimonials, testimonialCounts, type TestimonialAction } from "@/lib/services/testimonials";
import { getStatusMeta } from "@/lib/status-map";
import { useListData } from "@/lib/use-list-data";

const ID_PREFIX = "testimonials";
const EMPTY_COPY: Record<TestimonialStatus, string> = {
  pending: "Nothing is waiting for a decision.",
  approved: "No testimonial is published.",
  unpublished: "No testimonial has been unpublished.",
  rejected: "No testimonial has been rejected.",
};

export default function TestimonialsPage() {
  return (
    <RequireAccess screen="testimonials">
      <TestimonialsContent />
    </RequireAccess>
  );
}

function TestimonialsContent() {
  const { rows: loaded, isLoading, error, retry } = useListData(loadTestimonials, { subscribe: subscribeTestimonials });
  const live = useMockCollection("testimonials");
  const { can } = useRoles();
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [tab, setTab] = useState<TestimonialStatus>("pending");
  const canEdit = can("testimonials", "edit");

  // The queue works on the live store once the first load is done (a forced ?state=empty keeps it empty).
  const all = useMemo(() => (loaded === null ? null : loaded.length === 0 ? [] : sortTestimonials(live)), [loaded, live]);
  const counts = useMemo(() => (all ? testimonialCounts(all) : null), [all]);
  const tabs = TESTIMONIAL_STATUSES.map((value) => ({ value, label: getStatusMeta(value).label, count: counts ? counts[value] : undefined }));
  const visible = (all ?? []).filter((item) => item.status === tab);

  const run = (action: TestimonialAction, item: Testimonial) => {
    // TODO(backend): persist this change
    if (!applyTestimonialAction(item.id, action)) return;
    const message: Record<TestimonialAction, string> = {
      approve: `${item.author}'s testimonial was approved and is now public.`,
      reject: `${item.author}'s testimonial was rejected.`,
      unpublish: `${item.author}'s testimonial was unpublished.`,
      reapprove: `${item.author}'s testimonial was approved again and is public.`,
    };
    toast.success(message[action]);
  };

  const onAction = (action: TestimonialAction, item: Testimonial) => {
    if (action === "reject") {
      confirm({
        title: "Reject this testimonial?",
        description: <>{item.author}&apos;s testimonial will not be shown on the public site. You can re-approve it later.</>,
        confirmLabel: "Reject testimonial",
        onConfirm: () => run(action, item),
      });
    } else if (action === "unpublish") {
      confirm({
        title: "Unpublish this testimonial?",
        description: <>{item.author}&apos;s testimonial will be taken off the public site. You can re-approve it later.</>,
        confirmLabel: "Unpublish testimonial",
        onConfirm: () => run(action, item),
      });
    } else run(action, item);
  };

  return (
    <ListPage
      title="Testimonials"
      subtitle="Stories from seekers, hirers and partners, waiting for a decision."
      toolbar={
        <div className="space-y-4">
          <NotConnectedNotice />
          <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Testimonial status" idPrefix={ID_PREFIX} />
        </div>
      }
    >
      <div role="tabpanel" id={tabPanelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)} className="space-y-3">
        {isLoading && (
          <div aria-busy="true" aria-label="Loading" className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-full" />
                  <Skeleton className="h-5 w-1/3" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </div>
        )}
        {!isLoading && error && (
          <Card>
            <EmptyState
              icon={Quote}
              tone="danger"
              title="Could not load the testimonials"
              description={error}
              action={
                <Button variant="secondary" onClick={retry}>
                  Try again
                </Button>
              }
            />
          </Card>
        )}
        {!isLoading && !error && all && all.length === 0 && (
          <Card>
            <EmptyState icon={Quote} title="No testimonials yet" description="Stories sent in by seekers, hirers and partners appear here." />
          </Card>
        )}
        {!isLoading && !error && all && all.length > 0 && visible.length === 0 && (
          <Card>
            <EmptyState icon={Quote} title={`No ${getStatusMeta(tab).label.toLowerCase()} testimonials`} description={EMPTY_COPY[tab]} />
          </Card>
        )}
        {!isLoading && !error && visible.map((item) => <TestimonialCard key={item.id} item={item} canEdit={canEdit} onAction={onAction} />)}
      </div>
      {dialog}
    </ListPage>
  );
}
