"use client";

/**
 * Hirer detail: one hirer / company account.
 * Built on the shared detail template.
 *
 * Fields: Recruiter, Recruiter Email, Joined, Active Postings, industry, location, verification
 * summary + status, and (when linked) the "Go to Verification Review" link.
 * Actions: Suspend account (danger zone, with a confirm dialog) and Reinstate account (header).
 * Data: services/directory.ts: mock accounts in mock mode (changes go to the shared mock store), the admin API
 * (read only) otherwise. Actions stay local until the backend persists them.
 */
import { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Ban, RotateCcw, ShieldCheck } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { loadHirer } from "@/lib/services/directory";
import { getStatusMeta } from "@/lib/status-map";
import { useDetailData } from "@/lib/use-detail-data";
import { DangerZone } from "@/components/detail/DangerZone";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { MiniStat } from "@/components/ui/MiniStat";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

export default function HirerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadHirer(id), [id]);
  const { status, record: hirer, setRecord, error, retry } = useDetailData(load, { collection: "hirers" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : hirer ? hirer.companyName : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this hirer."} onRetry={retry} />;
  if (!hirer) return <DetailNotFound noun="Hirer" listLabel="Hirers Directory" listHref="/hirers" />;

  const isActive = hirer.status === "active";

  const suspend = () =>
    confirm({
      title: "Suspend this account?",
      description: (
        <>
          <strong className="text-ink">{hirer.companyName}</strong> (recruiter {hirer.recruiterName}, {hirer.recruiterEmail}) will be
          marked as Suspended. You can reinstate the account later.
        </>
      ),
      confirmLabel: "Suspend account",
      onConfirm: () => {
        // TODO(backend): persist this change
        setRecord((prev) => ({ ...prev, status: "suspended" }));
        toast.success(`${hirer.companyName} was suspended.`);
      },
    });

  const reinstate = () => {
    // TODO(backend): persist this change
    setRecord((prev) => ({ ...prev, status: "active" }));
    toast.success(`${hirer.companyName} was reinstated.`);
  };

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ name: hirer.companyName }}
            title={hirer.companyName}
            // Two badges: the verification summary, then the account status.
            badges={
              <>
                <StatusBadge status={hirer.verification} />
                <StatusBadge status={hirer.status} />
              </>
            }
            meta={`${hirer.industry} · ${hirer.location}`}
            actions={
              !isActive && (
                <Button variant="secondary" icon={RotateCcw} onClick={reinstate}>
                  Reinstate account
                </Button>
              )
            }
          />
        }
        main={
          <>
            <InfoCard title="Activity">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MiniStat value={hirer.postingsCount} label="Active Postings" />
              </div>
            </InfoCard>

            {hirer.linkedVerificationId && (
              <InfoCard title="Verification">
                <p className="input-text text-ink">
                  This company&apos;s verification documents are {getStatusMeta(hirer.verification).label.toLowerCase()}.
                </p>
                <Link href={`/verification/${hirer.linkedVerificationId}`} className={`${buttonClasses("secondary")} mt-4`}>
                  <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                  Go to Verification Review
                </Link>
              </InfoCard>
            )}
          </>
        }
        side={
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Recruiter", value: hirer.recruiterName },
                { label: "Recruiter Email", value: hirer.recruiterEmail },
                { label: "Joined", value: formatDate(hirer.joinedDate) },
              ]}
            />
          </InfoCard>
        }
        danger={
          isActive && (
            <DangerZone explanation="Marks this company's account as Suspended. You can reinstate it at any time.">
              <Button variant="danger" icon={Ban} onClick={suspend}>
                Suspend account
              </Button>
            </DangerZone>
          )
        }
      />
      {dialog}
    </>
  );
}
