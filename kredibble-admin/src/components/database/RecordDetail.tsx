"use client";

/**
 * RecordDetail: one beneficiary record (/database/[id]). Built on the shared detail template.
 *
 * - Header: avatar, name, the verified or pending badge, institution and country, and a "Verify" action while the record is
 *   pending (edit access on database only: a role that can just view sees no Verify). Verifying updates the page at once, the
 *   Database pace gauge, the sidebar pill and the KPI, and a toast offers Undo for 5 seconds.
 * - Main: Details (email, phone, country, institution, source, added by and on, verified on).
 * - Side: Links (the referring ambassador and the opportunity: links only for a role that can view those pages, otherwise
 *   plain text).
 * The record is read from the live store, so it changes in the same render as everything else. Outside mock mode a notice says
 * the page shows sample data. The dev ?state=loading|notfound|error switch works.
 *
 * Props: id (the record id)
 */
import Link from "next/link";
import { useCallback } from "react";
import { BadgeCheck } from "lucide-react";
import { useRoles } from "@/components/access/RoleProvider";
import { useVerifyRecord } from "@/components/database/use-verify-record";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { NotConnectedNotice } from "@/components/ui/NotConnectedNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { formatDate } from "@/lib/format";
import { RECORD_SOURCE_LABELS } from "@/lib/mock-entities";
import { useMockCollection } from "@/lib/mock-store";
import { loadRecord, recordLinkAccess, subscribeDatabase, withNames } from "@/lib/services/database";
import { useDetailData } from "@/lib/use-detail-data";

export function RecordDetail({ id }: { id: string }) {
  const { can } = useRoles();
  const canEdit = can("database", "edit");
  const access = recordLinkAccess(can);
  const load = useCallback(() => loadRecord(id), [id]);
  const { status, record: loaded, error, retry } = useDetailData(load, { subscribe: subscribeDatabase });
  const records = useMockCollection("databaseRecords");
  const verify = useVerifyRecord();

  // Once loaded, the record comes from the live store, so a verification shows in the render it happens in.
  const live = records.find((entry) => entry.id === id);
  const record = loaded && live ? withNames(live) : undefined;

  useBreadcrumbLabel(status === "loading" ? undefined : record ? record.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this record."} onRetry={retry} />;
  if (!record) return <DetailNotFound noun="Record" listLabel="Database" listHref="/database" />;

  const actions =
    canEdit && !record.verified ? (
      <Button icon={BadgeCheck} onClick={() => verify(record)}>
        Verify
      </Button>
    ) : undefined;

  const linkClass = "font-semibold text-purple-700 hover:underline";
  const ambassador = record.ambassadorId ? (record.ambassadorName ?? "Ambassador") : undefined;
  const opportunity = record.listingId ? (record.listingTitle ?? "Opportunity") : undefined;

  return (
    <>
      <NotConnectedNotice className="mb-4" />
      <DetailPage
        header={
          <DetailHeader
            leading={{ name: record.name }}
            eyebrow={<TagPill>{RECORD_SOURCE_LABELS[record.source]}</TagPill>}
            title={record.name}
            badges={<StatusBadge status={record.verified ? "verified" : "pending"} />}
            meta={`${record.institution} · ${record.country}`}
            actions={actions}
          />
        }
        main={
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Email", value: record.email },
                { label: "Phone", value: record.phone },
                { label: "Country", value: record.country },
                { label: "Institution", value: record.institution },
                { label: "Source", value: RECORD_SOURCE_LABELS[record.source] },
                { label: "Added by", value: record.addedByName },
                { label: "Added on", value: formatDate(record.createdAt) },
                { label: "Verified on", value: record.verifiedAt ? formatDate(record.verifiedAt) : undefined },
              ]}
            />
          </InfoCard>
        }
        side={
          <InfoCard title="Links">
            <KeyValueList
              items={[
                {
                  label: "Ambassador",
                  value: ambassador ? (
                    access.ambassador ? (
                      <Link data-testid="detail-ambassador" href={`/network/${record.ambassadorId}`} className={linkClass}>
                        {ambassador}
                      </Link>
                    ) : (
                      <span data-testid="detail-ambassador">{ambassador}</span>
                    )
                  ) : undefined,
                },
                {
                  label: "Opportunity",
                  value: opportunity ? (
                    access.opportunity ? (
                      <Link data-testid="detail-opportunity" href={`/opportunities/${record.listingId}`} className={linkClass}>
                        {opportunity}
                      </Link>
                    ) : (
                      <span data-testid="detail-opportunity">{opportunity}</span>
                    )
                  ) : undefined,
                },
              ]}
            />
          </InfoCard>
        }
      />
    </>
  );
}
