"use client";

/**
 * RecordCard: one beneficiary record as a COMPACT card on phones (below 640px), used by the Database list (DataTable renderCard).
 *
 *   (KM) Kwesi Mukasa                         [ Pending ]     <- avatar, name (the row link) and email, the status badge at the right
 *   Ghana · University of Ghana                               <- ONE line, cut with an ellipsis and a tooltip when it must
 *   [ Organic ]  Youth Innovation Fellowship                  <- the source pill and the linked item (one line)
 *   [ Verify ]            (NY) Nana Yaa Boateng · 7 Oct 2026  <- the Verify button (pending, for a role that can edit) and who added it
 *
 * About 130 to 170px tall (the generic stack of labelled values was about 270px). The name is the row's stretched link; the Verify
 * button and the linked item sit above it (relative z-10), so each does its own thing and a tap elsewhere opens the record.
 *
 * Props: record (a RecordRow), access ({ ambassador, opportunity }), canEdit, onVerify
 */
import { LinkedCell } from "@/components/database/LinkedCell";
import { VerifyButton } from "@/components/database/VerifyButton";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { TruncatedLink, TruncatedText } from "@/components/ui/TruncatedText";
import { formatDate } from "@/lib/format";
import { RECORD_SOURCE_LABELS } from "@/lib/mock-entities";
import type { RecordRow } from "@/lib/services/database";

interface RecordCardProps {
  record: RecordRow;
  access: { ambassador: boolean; opportunity: boolean };
  canEdit: boolean;
  onVerify: () => void;
}

export function RecordCard({ record, access, canEdit, onVerify }: RecordCardProps) {
  return (
    <div data-testid="record-card" className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={record.name} size="sm" />
          <div className="min-w-0">
            <TruncatedLink
              href={`/database/${record.id}`}
              text={record.name}
              className="table-text font-semibold text-ink outline-none after:absolute after:inset-0 after:rounded-inset focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
            />
            <TruncatedText text={record.email} className="caption" />
          </div>
        </div>
        <StatusBadge status={record.verified ? "verified" : "pending"} />
      </div>
      <TruncatedText text={`${record.country} · ${record.institution}`} className="caption text-ink" />
      <div className="flex items-center gap-2">
        <TagPill className="whitespace-nowrap">{RECORD_SOURCE_LABELS[record.source]}</TagPill>
        <div className="min-w-0 flex-1">
          <LinkedCell record={record} access={access} single />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {!record.verified && canEdit ? <VerifyButton name={record.name} onVerify={onVerify} /> : <span />}
        <div className="flex min-w-0 items-center gap-1.5">
          {record.addedByName && <Avatar name={record.addedByName} size="xs" />}
          <TruncatedText text={`${record.addedByName ?? "—"} · ${formatDate(record.createdAt)}`} className="caption" />
        </div>
      </div>
    </div>
  );
}
