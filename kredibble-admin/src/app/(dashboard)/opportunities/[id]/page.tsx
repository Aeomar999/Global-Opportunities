"use client";

/**
 * Opportunity detail (/opportunities/[id]): ONE route for both sources of the Opportunities Queue.
 *   - A staff-curated listing (an id in the listings collection) shows CuratedListingDetail.
 *   - A hirer-submitted posting shows the review page below: approve and reject.
 * Built on the shared detail template.
 *
 * Fields: type, title, company, location, status, Description, Posted, Applicants, Work Type (when
 * present), Salary (when present), and for events / grants an Event Details or Grant Details card
 * (Date & Time, Category, Budget, Sector, each when present).
 * Actions: Approve (header) and Reject (danger zone, with a confirm dialog).
 * Data: mock postings (src/lib/mock-opportunities.ts), changed in LOCAL state only.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { Briefcase, CalendarDays, Check, GraduationCap, HandCoins, X, type LucideIcon } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { postedOpportunities, type OpportunityType } from "@/lib/mock-opportunities";
import { useMockCollection } from "@/lib/mock-store";
import { useRoles, VIEW_ONLY_TOOLTIP } from "@/components/access/RoleProvider";
import { CuratedListingDetail } from "@/components/opportunities/CuratedListingDetail";
import { Tooltip } from "@/components/ui/Tooltip";
import { useDetailData } from "@/lib/use-detail-data";
import { DangerZone } from "@/components/detail/DangerZone";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { MiniStat } from "@/components/ui/MiniStat";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { useToast } from "@/components/ui/Toast";

const TYPE_META: Record<OpportunityType, { label: string; icon: LucideIcon }> = {
  jobs: { label: "Job", icon: Briefcase },
  internships: { label: "Internship", icon: GraduationCap },
  events: { label: "Event", icon: CalendarDays },
  grants: { label: "Grant", icon: HandCoins },
};

export default function OpportunityPage() {
  const { id } = useParams<{ id: string }>();
  const listings = useMockCollection("listings");
  return listings.some((listing) => listing.id === id) ? <CuratedListingDetail id={id} /> : <HirerPostingReview />;
}

function HirerPostingReview() {
  const { id } = useParams<{ id: string }>();
  const { can } = useRoles();
  const canModerate = can("opportunities_queue", "edit");
  const load = useCallback(() => Promise.resolve(postedOpportunities.find((o) => o.id === id)), [id]);
  const { status, record: opp, setRecord, error, retry } = useDetailData(load, { collection: "opportunities" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : opp ? opp.title : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this opportunity."} onRetry={retry} />;
  if (!opp) return <DetailNotFound noun="Opportunity" listLabel="Opportunities Queue" listHref="/opportunities" />;

  const type = TYPE_META[opp.type];
  const hasExtraDetails = opp.eventDateTime || opp.eventCategory || opp.grantBudgetRange || opp.grantSector;

  const approve = () => {
    // TODO(backend): persist this change
    setRecord((prev) => ({ ...prev, moderationStatus: "approved" }));
    toast.success(`${opp.title} from ${opp.company} was approved.`);
  };

  const reject = () =>
    confirm({
      title: "Reject this opportunity?",
      description: (
        <>
          <strong className="text-ink">{opp.title}</strong> from <strong className="text-ink">{opp.company}</strong> will be marked
          Rejected in the moderation queue.
        </>
      ),
      confirmLabel: "Reject opportunity",
      onConfirm: () => {
        // TODO(backend): persist this change
        setRecord((prev) => ({ ...prev, moderationStatus: "rejected" }));
        toast.success(`${opp.title} from ${opp.company} was rejected.`);
      },
    });

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: type.icon }}
            eyebrow={<TagPill icon={type.icon}>{type.label}</TagPill>}
            title={opp.title}
            badges={<StatusBadge status={opp.moderationStatus} />}
            meta={`${opp.company} · ${opp.location}`}
            actions={
              canModerate ? (
                <Button icon={Check} onClick={approve} disabled={opp.moderationStatus === "approved"}>
                  Approve
                </Button>
              ) : (
                <Tooltip label={VIEW_ONLY_TOOLTIP}>
                  <Button icon={Check} disabled>
                    Approve
                  </Button>
                </Tooltip>
              )
            }
          />
        }
        main={
          <>
            <InfoCard title="Description">
              <p className="input-text text-ink">{opp.description}</p>
            </InfoCard>

            {hasExtraDetails && (
              <InfoCard title={opp.type === "events" ? "Event Details" : "Grant Details"}>
                <KeyValueList
                  items={[
                    { label: "Date & Time", value: opp.eventDateTime },
                    { label: "Category", value: opp.eventCategory },
                    { label: "Budget", value: opp.grantBudgetRange },
                    { label: "Sector", value: opp.grantSector },
                  ]}
                />
              </InfoCard>
            )}
          </>
        }
        side={
          <>
            <InfoCard title="Details">
              <KeyValueList
                items={[
                  { label: "Posted", value: formatDate(opp.date) },
                  { label: "Work Type", value: opp.workType },
                  { label: "Salary", value: opp.salary },
                ]}
              />
            </InfoCard>
            <InfoCard title="Activity">
              <MiniStat value={opp.applicantsCount} label="Applicants" />
            </InfoCard>
          </>
        }
        danger={
          <DangerZone explanation="Marks this posting as Rejected in the moderation queue. You can still approve it afterwards.">
            {canModerate ? (
              <Button variant="danger" icon={X} onClick={reject} disabled={opp.moderationStatus === "rejected"}>
                Reject opportunity
              </Button>
            ) : (
              <Tooltip label={VIEW_ONLY_TOOLTIP}>
                <Button variant="danger" icon={X} disabled>
                  Reject opportunity
                </Button>
              </Tooltip>
            )}
          </DangerZone>
        }
      />
      {dialog}
    </>
  );
}
