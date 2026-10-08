"use client";

/**
 * TestimonialCard: one story in the moderation queue.
 *
 *   (AO)  Abena Owusu                                           [ Pending ]
 *         Software engineer, Accra  ·  Submitted 14 Sep 2026
 *   "I found my first job through a listing on the desk..."          <- the comment, cut at three lines with the full text in the tooltip
 *   Staff only   [lock] abena.owusu@god.example                       <- the email, ONLY for a role that can edit testimonials
 *   Public preview                                                    <- approved items only
 *   | (AO) Abena Owusu: "I found my first job..."          |         <- the name, the comment and the (initials) photo, and NOTHING else
 *   [ Approve ] [ Reject ]                                            <- by status; icon-only 40px with a tooltip, words on phones
 *
 * ACTIONS by status: pending has Approve and Reject; approved has Unpublish; unpublished and rejected have Re-approve. They sit in the
 * card HEADER, to the right under the status badge: labelled buttons from 1024px (Approve is the primary one), icon-only with a
 * tooltip from 640 to 1023px, icon and words on a phone. They are rendered ONLY for a role that can edit testimonials (not disabled: absent). So is the email: a role that can only view sees
 * no email anywhere on the card. The public preview never contains the email, for anyone: it is built from the name and the
 * comment alone (publicPreview() in services/testimonials.ts), and its markup is checked in the tests.
 *
 * Props: item (a Testimonial), canEdit, onAction(action, item)
 */
import { Check, EyeOff, Lock, RotateCcw, X, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { IconTextButton } from "@/components/ui/IconTextButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TruncatedText } from "@/components/ui/TruncatedText";
import { formatDate } from "@/lib/format";
import type { Testimonial } from "@/lib/mock-entities";
import { ACTIONS_BY_STATUS, publicPreview, type TestimonialAction } from "@/lib/services/testimonials";

const ACTION_META: Record<TestimonialAction, { label: string; tooltip: string; icon: LucideIcon; variant: "primary" | "secondary" }> = {
  approve: { label: "Approve", tooltip: "Approve and publish this testimonial", icon: Check, variant: "primary" },
  reject: { label: "Reject", tooltip: "Reject this testimonial", icon: X, variant: "secondary" },
  unpublish: { label: "Unpublish", tooltip: "Take this testimonial off the public site", icon: EyeOff, variant: "secondary" },
  reapprove: { label: "Re-approve", tooltip: "Approve and publish this testimonial again", icon: RotateCcw, variant: "secondary" },
};

interface TestimonialCardProps {
  item: Testimonial;
  canEdit: boolean;
  onAction: (action: TestimonialAction, item: Testimonial) => void;
}

export function TestimonialCard({ item, canEdit, onAction }: TestimonialCardProps) {
  const preview = publicPreview(item);
  return (
    <Card as="article" ariaLabel={`Testimonial from ${item.author}`} testId={`testimonial-${item.id}`} className="space-y-2.5 max-sm:space-y-2 max-sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar name={item.author} size="md" />
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold leading-6 text-ink">{item.author}</h3>
            <p className="caption">
              {item.role} · Submitted <span className="tabular-nums">{formatDate(item.submittedAt)}</span>
            </p>
          </div>
        </div>
        <div data-testid="card-header-side" className="flex shrink-0 flex-col items-end gap-2 max-sm:w-full max-sm:flex-row max-sm:items-center max-sm:justify-between">
          <StatusBadge status={item.status} />
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              {ACTIONS_BY_STATUS[item.status].map((action) => {
                const meta = ACTION_META[action];
                return (
                  <IconTextButton
                    key={action}
                    icon={meta.icon}
                    label={meta.label}
                    tooltip={meta.tooltip}
                    ariaLabel={`${meta.label} ${item.author}`}
                    testId={`action-${action}`}
                    variant={meta.variant}
                    wordsFrom="lg"
                    onClick={() => onAction(action, item)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <TruncatedText text={item.quote} lines={3} className="body-sm text-ink" />

      {canEdit && (
        <p data-testid="staff-email" className="caption flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 font-semibold text-ink">
            <Lock size={12} strokeWidth={2} aria-hidden="true" />
            Staff only
          </span>
          <span className="break-all">{item.email}</span>
        </p>
      )}

      {item.status === "approved" && (
        <div className="rounded-inset border border-line bg-surface-2 p-3">
          <p className="caption mb-2 font-semibold text-ink">Public preview</p>
          <div data-testid="public-preview" className="flex items-start gap-3">
            <Avatar name={preview.name} size="sm" />
            <div className="min-w-0">
              <p className="table-text font-semibold text-ink">{preview.name}</p>
              <p className="body-sm text-ink">{preview.comment}</p>
            </div>
          </div>
        </div>
      )}

    </Card>
  );
}
