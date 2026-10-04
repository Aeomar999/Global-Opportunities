"use client";

/**
 * Report detail: one trust & safety report.
 * Built on the shared detail template.
 *
 * Fields: target type, target label, status, Reason, Reported by, Date, the details text, and (when
 * linked) the "View the channel this report is about" link.
 * Actions: Mark resolved (header) and Dismiss (header, with a confirm dialog because it closes the
 * report without action).
 * Data: mock reports (src/lib/mock-reports.ts), changed in LOCAL state only.
 *
 * "Open" is a warning on a report (it waits on a person): StatusBadge kind="report".
 */
import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Flag, Hash, XCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { reports } from "@/lib/mock-reports";
import { useDetailData } from "@/lib/use-detail-data";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagPill } from "@/components/ui/TagPill";
import { useToast } from "@/components/ui/Toast";

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => Promise.resolve(reports.find((r) => r.id === id)), [id]);
  const { status, record: report, setRecord, error, retry } = useDetailData(load, { collection: "reports" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : report ? report.targetLabel : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this report."} onRetry={retry} />;
  if (!report) return <DetailNotFound noun="Report" listLabel="Reports Queue" listHref="/reports" />;

  const resolve = () => {
    // TODO(backend): persist this change
    setRecord((prev) => ({ ...prev, status: "resolved" }));
    toast.success(`The report about ${report.targetLabel} was resolved.`);
  };

  const dismiss = () =>
    confirm({
      title: "Dismiss this report?",
      description: (
        <>
          The report about <strong className="text-ink">{report.targetLabel}</strong> (reported by {report.reporterName}) will be
          marked Dismissed, with no action taken.
        </>
      ),
      confirmLabel: "Dismiss report",
      tone: "neutral",
      onConfirm: () => {
        // TODO(backend): persist this change
        setRecord((prev) => ({ ...prev, status: "dismissed" }));
        toast.success(`The report about ${report.targetLabel} was dismissed.`);
      },
    });

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: Flag }}
            eyebrow={<TagPill>{capitalise(report.targetType)}</TagPill>}
            title={report.targetLabel}
            badges={<StatusBadge status={report.status} kind="report" />}
            actions={
              <>
                <Button icon={CheckCircle2} onClick={resolve} disabled={report.status === "resolved"}>
                  Mark resolved
                </Button>
                <Button variant="secondary" icon={XCircle} onClick={dismiss} disabled={report.status === "dismissed"}>
                  Dismiss
                </Button>
              </>
            }
          />
        }
        main={
          <InfoCard title="Report Details">
            <p className="input-text text-ink">{report.details}</p>
            {report.linkedChannelId && (
              <Link href={`/community/${report.linkedChannelId}`} className={`${buttonClasses("secondary")} mt-4`}>
                <Hash size={16} strokeWidth={1.75} aria-hidden="true" />
                View the channel this report is about
              </Link>
            )}
          </InfoCard>
        }
        side={
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Reason", value: report.reason },
                { label: "Reported by", value: report.reporterName },
                { label: "Date", value: formatDate(report.date) },
              ]}
            />
          </InfoCard>
        }
      />
      {dialog}
    </>
  );
}
