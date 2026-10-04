"use client";

/**
 * Opportunity review: one posting awaiting moderation.
 * Built on the shared detail template.
 *
 * Fields: type, title, company, location, status, Description, Posted, Applicants, Work Type (when
 * present), Salary (when present), and for events / grants an Event Details or Grant Details card
 * (Date & Time, Category, Budget, Sector, each when present).
 * Actions: Approve (header) and Reject (danger zone, with a confirm dialog). Approving vets and publishes the
 * posting, so on the API it reads Published. While a decision saves, both buttons wait; a failed decision shows
 * the server's message and leaves the posting as it was.
 * Data: src/lib/services/opportunities.ts: mock postings (src/lib/mock-opportunities.ts) kept in the shared mock
 * store in mock mode, the admin API otherwise.
 */
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { opportunityTypeMeta } from "@/lib/opportunity-types";
import { decideOpportunity, isApprovedStatus, loadOpportunity, type ModerationDecision, type Opportunity } from "@/lib/services/opportunities";
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

export default function OpportunityReviewPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadOpportunity(id), [id]);
  const { status, record: opp, setRecord, error, retry } = useDetailData<Opportunity>(load, { collection: "opportunities" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [saving, setSaving] = useState(false);

  useBreadcrumbLabel(status === "loading" ? undefined : opp ? opp.title : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this opportunity."} onRetry={retry} />;
  if (!opp) return <DetailNotFound noun="Opportunity" listLabel="Opportunities Queue" listHref="/opportunities" />;

  const type = opportunityTypeMeta(opp.type);
  const hasExtraDetails = opp.eventDateTime || opp.eventCategory || opp.grantBudgetRange || opp.grantSector;

  const decide = async (decision: ModerationDecision, successMessage: string) => {
    setSaving(true);
    try {
      const updated = await decideOpportunity(opp, decision);
      setRecord(() => updated);
      toast.success(successMessage);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not update this opportunity.");
    } finally {
      setSaving(false);
    }
  };

  const approve = () => {
    void decide("approve", `${opp.title} from ${opp.company} was approved.`);
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
        void decide("reject", `${opp.title} from ${opp.company} was rejected.`);
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
              <Button icon={Check} onClick={approve} disabled={isApprovedStatus(opp.moderationStatus) || saving}>
                Approve
              </Button>
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
            <Button variant="danger" icon={X} onClick={reject} disabled={opp.moderationStatus === "rejected" || saving}>
              Reject opportunity
            </Button>
          </DangerZone>
        }
      />
      {dialog}
    </>
  );
}
