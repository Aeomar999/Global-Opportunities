"use client";

/**
 * Verification review: one company's submitted documents.
 * Built on the shared detail template.
 *
 * Fields: Website, Company Email, Submitted, recruiter Name / Position / Email, industry, company size,
 * location, the overall status, and four documents (Business registration, Org ID, Company logo,
 * Proof of org), each with its file name, status, Approve and Reject.
 * Header (right): a muted summary derived from the documents ("1 of 4 documents approved").
 * Actions: Approve and Reject per document (icon buttons with tooltips; Approve is disabled on an approved
 * document and Reject on a rejected one). Reject asks for confirmation. The overall status is derived:
 * all approved -> Approved, any rejected -> Rejected, otherwise Pending. While one change is saving, every
 * document's buttons wait, so two changes never derive the overall status from a stale record.
 * A document the company never uploaded shows "Not submitted" and has no actions.
 * Data: src/lib/services/verification.ts: mock companies (src/lib/mock-data.ts) kept in the shared mock store
 * in mock mode, the admin API otherwise. A failed change shows the server's message and leaves the record as it was.
 *
 * Per-document actions stay on their own rows (they act on ONE document), so there is no danger-zone card here.
 */
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { Check, FileText, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import type { DocStatus } from "@/lib/mock-data";
import {
  DOC_KEYS,
  DOC_LABELS,
  loadVerificationReview,
  setVerificationDocStatus,
  type DocKey,
  type VerificationReview,
} from "@/lib/services/verification";
import { useDetailData } from "@/lib/use-detail-data";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { TruncatedText } from "@/components/ui/TruncatedText";

export default function VerificationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadVerificationReview(id), [id]);
  const { status, record: company, setRecord, error, retry } = useDetailData<VerificationReview>(load, { collection: "verification" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  const [saving, setSaving] = useState(false);

  useBreadcrumbLabel(status === "loading" ? undefined : company ? company.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this company."} onRetry={retry} />;
  if (!company) return <DetailNotFound noun="Company" listLabel="Verification Queue" listHref="/verification" />;

  const approvedCount = DOC_KEYS.filter((key) => company.docs[key]?.status === "approved").length;
  const meta = [company.industry, company.companySize, company.location].filter(Boolean).join(" · ");

  const setDocStatus = async (key: DocKey, next: DocStatus, successMessage: string) => {
    setSaving(true);
    try {
      const updated = await setVerificationDocStatus(company, key, next);
      setRecord(() => updated);
      toast.success(successMessage);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Could not update this document.");
    } finally {
      setSaving(false);
    }
  };

  const approve = (key: DocKey, label: string) => {
    void setDocStatus(key, "approved", `${label} for ${company.name} was approved.`);
  };

  const reject = (key: DocKey, label: string, fileName: string) => {
    confirm({
      title: "Reject this document?",
      description: (
        <>
          The <strong className="text-ink">{label}</strong> ({fileName}) from{" "}
          <strong className="text-ink">{company.name}</strong> will be marked Rejected, and the company&apos;s overall verification will
          show Rejected.
        </>
      ),
      confirmLabel: "Reject document",
      onConfirm: () => {
        void setDocStatus(key, "rejected", `${label} for ${company.name} was rejected.`);
      },
    });
  };

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ name: company.name }}
            title={company.name}
            badges={<StatusBadge status={company.overallStatus} />}
            meta={meta || undefined}
            actions={<p className="body-sm text-muted">{approvedCount} of {DOC_KEYS.length} documents approved</p>}
          />
        }
        main={
          <InfoCard title="Verification Documents">
            <ul className="space-y-3">
              {DOC_KEYS.map((key) => {
                const doc = company.docs[key];
                if (!doc) {
                  return (
                    <li key={key} className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3">
                      <IconTile icon={FileText} tone="accent" size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="body-sm font-semibold text-ink">{DOC_LABELS[key]}</p>
                        <p className="caption">No file uploaded yet</p>
                      </div>
                      <StatusBadge status="not_submitted" />
                    </li>
                  );
                }
                return (
                  <li key={key} className="flex flex-wrap items-center gap-3 rounded-control border border-line p-3">
                    <IconTile icon={FileText} tone="accent" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="body-sm font-semibold text-ink">{doc.label}</p>
                      <TruncatedText text={doc.fileName} className="caption" />
                    </div>
                    <StatusBadge status={doc.status} />
                    <div className="flex shrink-0 items-center gap-2">
                      <IconButton
                        label={`Approve ${doc.label}`}
                        tooltip="Approve document"
                        icon={Check}
                        tone="success"
                        disabled={doc.status === "approved" || saving}
                        onClick={() => approve(key, doc.label)}
                      />
                      <IconButton
                        label={`Reject ${doc.label}`}
                        tooltip="Reject document"
                        icon={X}
                        tone="danger"
                        disabled={doc.status === "rejected" || saving}
                        onClick={() => reject(key, doc.label, doc.fileName)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </InfoCard>
        }
        side={
          <>
            <InfoCard title="Details">
              <KeyValueList
                items={[
                  { label: "Website", value: company.website },
                  { label: "Company Email", value: company.companyEmail },
                  { label: "Submitted", value: formatDate(company.submittedDate) },
                ]}
              />
            </InfoCard>
            <InfoCard title="Recruiter">
              <KeyValueList
                items={[
                  { label: "Name", value: company.recruiterName },
                  { label: "Position", value: company.recruiterRole },
                  { label: "Email", value: company.recruiterEmail },
                ]}
              />
            </InfoCard>
          </>
        }
      />
      {dialog}
    </>
  );
}
