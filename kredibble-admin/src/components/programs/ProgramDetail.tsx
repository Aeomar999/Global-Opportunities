"use client";

/**
 * ProgramDetail: one program (/programs/[id]). Built on the shared detail template, with the orange Programs accent.
 *
 * - Header: type tile and pill, title, status badge, country and format; an Edit button (edit access on programs; for a
 *   view-only role it is disabled with the standard tooltip).
 * - Main: Participants (the figure "42 of 60", a 6px purple bar and the percentage, always also as text), Facilitators
 *   (chips), Notes (when there are any).
 * - Side: Details (type, status, format, country, location, start, end, linked partner). The partner is a link when the
 *   viewer can see Partners (it opens the Partners page; there is no partner page yet), plain text otherwise.
 *   A delivered program says it counts toward the monthly target.
 * - Danger zone (edit access, program not yet delivered or cancelled): "Cancel program", with a confirm dialog. It sets
 *   the status to Cancelled, so Active drops by one on the list and Delivered does not change.
 * Data: services/programs.ts (live store). Each action carries a TODO(backend).
 *
 * Props: id (the program id)
 */
import Link from "next/link";
import { useCallback } from "react";
import { Ban, Pencil } from "lucide-react";
import { useRoles, VIEW_ONLY_TOOLTIP } from "@/components/access/RoleProvider";
import { formatDate, formatDateTime } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { cancelProgram, loadProgram, subscribeProgramStore } from "@/lib/services/programs";
import { useDetailData } from "@/lib/use-detail-data";
import { DangerZone } from "@/components/detail/DangerZone";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { PROGRAM_FORMAT_LABELS, PROGRAM_STATUS_LABELS, PROGRAM_TYPE_META } from "./program-meta";

export function ProgramDetail({ id }: { id: string }) {
  const { can } = useRoles();
  const canEdit = can("programs", "edit");
  const canSeePartners = can("partners", "view");
  const load = useCallback(() => loadProgram(id), [id]);
  const { status, record: program, error, retry } = useDetailData(load, { subscribe: subscribeProgramStore });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : program ? program.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this program."} onRetry={retry} />;
  if (!program) return <DetailNotFound noun="Program" listLabel="Programs" listHref="/programs" />;

  const type = PROGRAM_TYPE_META[program.type];
  const percent = Math.min(100, Math.round((program.participants / Math.max(1, program.target)) * 100));
  const cancellable = program.status === "planned" || program.status === "running";

  const cancel = () =>
    confirm({
      title: "Cancel this program?",
      description: (
        <>
          <strong className="text-ink">{program.name}</strong> will be marked Cancelled. It then no longer counts as Active, and it never
          counts toward the monthly target.
        </>
      ),
      confirmLabel: "Cancel program",
      onConfirm: () => {
        // TODO(backend): persist this change
        cancelProgram(program.id);
        toast.success(`${program.name} was cancelled.`);
      },
    });

  const editButton = canEdit ? (
    <Link href={`/programs/${program.id}/edit`} className={buttonClasses("secondary")}>
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
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: type.icon, tone: "brand" }}
            eyebrow={<TagPill icon={type.icon}>{type.label}</TagPill>}
            title={program.name}
            badges={<StatusBadge status={program.status} />}
            meta={`${program.country} · ${PROGRAM_FORMAT_LABELS[program.format]}`}
            actions={editButton}
          />
        }
        main={
          <>
            <InfoCard title="Participants">
              <div className="flex items-baseline justify-between gap-3">
                <p data-testid="participants-figure" className="font-display text-2xl font-extrabold tabular-nums text-ink">
                  {program.participants} of {program.target}
                </p>
                <p className="font-semibold tabular-nums text-ink">{percent}%</p>
              </div>
              <div
                role="progressbar"
                aria-label={`Participants: ${percent}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="mt-2 h-1.5 overflow-hidden rounded-pill bg-track"
              >
                {/* Data-driven width: the one legitimate inline style. */}
                <div className="h-full rounded-pill bg-purple-500" style={{ width: `${percent}%` }} />
              </div>
              <p className="caption mt-2">People taking part now, against the target.</p>
            </InfoCard>

            <InfoCard title="Facilitators">
              {program.facilitators.length > 0 ? (
                <ul aria-label="Facilitators" className="flex flex-wrap gap-2">
                  {program.facilitators.map((name) => (
                    <li key={name} className="rounded-pill bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700">
                      {name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="input-text text-muted">No facilitators added yet. —</p>
              )}
            </InfoCard>

            {program.notes && (
              <InfoCard title="Notes">
                <p className="input-text whitespace-pre-line text-ink">{program.notes}</p>
              </InfoCard>
            )}
          </>
        }
        side={
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Type", value: type.label },
                { label: "Status", value: PROGRAM_STATUS_LABELS[program.status] },
                { label: "Format", value: PROGRAM_FORMAT_LABELS[program.format] },
                { label: "Country", value: program.country },
                { label: "Location", value: program.location },
                { label: "Starts", value: program.startAt.length === 10 ? formatDate(program.startAt) : formatDateTime(program.startAt) },
                { label: "Ends", value: program.endAt.length === 10 ? formatDate(program.endAt) : formatDateTime(program.endAt) },
                {
                  label: "Partner",
                  value: program.partnerName ? (
                    canSeePartners ? (
                      <Link href="/partners" data-testid="partner-link" className="font-medium text-purple-700 underline-offset-2 hover:underline">
                        {program.partnerName}
                      </Link>
                    ) : (
                      program.partnerName
                    )
                  ) : undefined,
                },
              ]}
            />
            {program.status === "delivered" && <p className="caption mt-3">Delivered programs count toward the monthly target.</p>}
          </InfoCard>
        }
        danger={
          canEdit && cancellable ? (
            <DangerZone explanation="Marks this program as Cancelled. It stops counting as Active and will not count toward the monthly target.">
              <Button variant="danger" icon={Ban} onClick={cancel}>
                Cancel program
              </Button>
            </DangerZone>
          ) : undefined
        }
      />
      {dialog}
    </>
  );
}
