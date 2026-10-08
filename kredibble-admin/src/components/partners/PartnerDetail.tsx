"use client";

/**
 * PartnerDetail: one partner (/partners/[id]). Built on the shared detail template, with the purple Partners accent.
 *
 * - Header: the organisation, its stage badge (the label from the store) and a "Closed" marker while it is closed
 *   (Onboard or Renew; it follows the stage and cannot be switched by hand), the type and country; an Edit button
 *   (edit access on partners; for a view-only role it is disabled with the standard tooltip).
 * - Main: Details (type, owner, country, what they provide, how sourced, notes), Contact (name, email, phone) and the
 *   Stage history timeline, newest first: "Outreach → Proposal" with the date, and a note when a step closed or
 *   re-opened the deal.
 * - Side: Linked programs (links when the viewer can see Programs).
 * - Danger zone (edit access): Remove partner, with a confirm dialog; programs that were linked to it lose the link.
 * Data: services/partners.ts (live store). Each action carries a TODO(backend).
 *
 * Props: id (the partner id)
 */
import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Flag, Handshake, Pencil, Trash2 } from "lucide-react";
import { useRoles, VIEW_ONLY_TOOLTIP } from "@/components/access/RoleProvider";
import { DangerZone } from "@/components/detail/DangerZone";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { formatDate } from "@/lib/format";
import { CLOSED_STAGES, PARTNER_TYPE_LABELS } from "@/lib/mock-entities";
import { usePartnerStageLabels } from "@/lib/mock-store";
import { loadPartner, programsOfPartner, removePartner, subscribePartners } from "@/lib/services/partners";
import { useDetailData } from "@/lib/use-detail-data";

export function PartnerDetail({ id }: { id: string }) {
  const { can } = useRoles();
  const canEdit = can("partners", "edit");
  const canSeePrograms = can("programs", "view");
  const labels = usePartnerStageLabels();
  const load = useCallback(() => loadPartner(id), [id]);
  const { status, record: partner, error, retry } = useDetailData(load, { subscribe: subscribePartners });
  const toast = useToast();
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : partner ? partner.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this partner."} onRetry={retry} />;
  if (!partner) return <DetailNotFound noun="Partner" listLabel="Partners" listHref="/partners" />;

  const programs = programsOfPartner(partner.id);
  const history: TimelineItem[] = partner.stageHistory
    .map((entry, index, all) => {
      const wasClosed = index > 0 && CLOSED_STAGES.includes(all[index - 1].stage);
      const nowClosed = CLOSED_STAGES.includes(entry.stage);
      const note = nowClosed && !wasClosed ? "The deal closed." : !nowClosed && wasClosed ? "The deal is open again." : "";
      return {
        key: `${entry.at}-${index}`,
        icon: nowClosed && !wasClosed ? CheckCircle2 : entry.from ? ArrowRight : Flag,
        tone: nowClosed ? ("success" as const) : ("accent" as const),
        title: entry.from ? `${labels[entry.from]} → ${labels[entry.stage]}` : `Added at ${labels[entry.stage]}`,
        description: note,
        time: formatDate(entry.at),
      };
    })
    .reverse();

  const remove = () =>
    confirm({
      title: "Remove this partner?",
      description: (
        <>
          <strong className="text-ink">{partner.name}</strong> and its stage history will be removed from the pipeline.
          {programs.length > 0 && ` ${programs.length === 1 ? "The program" : `The ${programs.length} programs`} linked to it will stay, without a partner.`}
        </>
      ),
      confirmLabel: "Remove partner",
      onConfirm: () => {
        // TODO(backend): persist this change
        removePartner(partner.id);
        toast.success(`${partner.name} was removed.`);
        router.push("/partners");
      },
    });

  const editButton = canEdit ? (
    <Link href={`/partners/${partner.id}/edit`} className={buttonClasses("secondary")}>
      <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
      Edit
    </Link>
  ) : (
    <Tooltip label={VIEW_ONLY_TOOLTIP}>
      <Button variant="secondary" icon={Pencil} disabled>
        Edit
      </Button>
    </Tooltip>
  );

  return (
    <>
      <NotConnectedNotice className="mb-4" />
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: Handshake }}
            eyebrow={<TagPill>{PARTNER_TYPE_LABELS[partner.type]}</TagPill>}
            title={partner.name}
            badges={
              <span className="flex flex-wrap items-center gap-2">
                <span data-testid="stage-badge">
                  <StatusBadge status={partner.stage} />
                </span>
                {partner.closed && (
                  <span data-testid="closed-marker" className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                    <CheckCircle2 size={12} strokeWidth={2} aria-hidden="true" />
                    Closed
                  </span>
                )}
              </span>
            }
            meta={`${partner.country} · ${labels[partner.stage]}`}
            actions={editButton}
          />
        }
        main={
          <>
            <InfoCard title="Details">
              <KeyValueList
                items={[
                  { label: "Type", value: PARTNER_TYPE_LABELS[partner.type] },
                  { label: "Owner", value: partner.ownerName },
                  { label: "Country", value: partner.country },
                  { label: "What they provide", value: partner.provides },
                  { label: "How sourced", value: partner.sourcedVia },
                  { label: "Notes", value: partner.notes },
                ]}
              />
            </InfoCard>

            <InfoCard title="Contact">
              <KeyValueList
                items={[
                  { label: "Name", value: partner.contactName },
                  {
                    label: "Email",
                    value: partner.contactEmail ? (
                      <a href={`mailto:${partner.contactEmail}`} className="font-medium text-purple-700 underline-offset-2 hover:underline">
                        {partner.contactEmail}
                      </a>
                    ) : undefined,
                  },
                  { label: "Phone", value: partner.contactPhone },
                ]}
              />
            </InfoCard>

            <InfoCard title="Stage history" subtitle="Every move between stages, newest first.">
              <div data-testid="stage-history">
                <Timeline items={history} />
              </div>
            </InfoCard>
          </>
        }
        side={
          <InfoCard title="Linked programs">
            {programs.length === 0 ? (
              <p className="input-text text-muted">No programs are linked to this partner yet. —</p>
            ) : (
              <ul data-testid="linked-programs" className="space-y-2">
                {programs.map((program) => (
                  <li key={program.id}>
                    {canSeePrograms ? (
                      <Link href={`/programs/${program.id}`} className="font-medium text-purple-700 underline-offset-2 hover:underline">
                        {program.name}
                      </Link>
                    ) : (
                      <span className="text-ink">{program.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </InfoCard>
        }
        danger={
          canEdit ? (
            <DangerZone explanation="Removes this partner and its history from the pipeline. Programs linked to it stay, without a partner.">
              <Button variant="danger" icon={Trash2} onClick={remove}>
                Remove partner
              </Button>
            </DangerZone>
          ) : undefined
        }
      />
      {dialog}
    </>
  );
}
