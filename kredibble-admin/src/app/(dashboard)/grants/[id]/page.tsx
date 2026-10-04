"use client";

/**
 * Grant detail: one grant's funding pool and its applications.
 * Built on the shared detail template.
 *
 * Fields: title, hirer, sector, funding pool (allocated, total, percent, remaining), and every
 * application (applicant, requested amount, status).
 * Actions: Approve (per pending application, disabled when the request exceeds what remains) and Reject
 * (per pending application, confirm dialog). Allocated is recalculated from approved applications.
 * Data: mock grants (src/lib/mock-grant-ops.ts), changed in LOCAL state only.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { Check, HandCoins, X } from "lucide-react";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { grantRecords, type GrantApplication } from "@/lib/mock-grant-ops";
import { useDetailData } from "@/lib/use-detail-data";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IconButton } from "@/components/ui/IconButton";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { MiniStat } from "@/components/ui/MiniStat";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

const money = (amount: number) => `$${amount.toLocaleString()}`;

export default function GrantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => Promise.resolve(grantRecords.find((g) => g.id === id)), [id]);
  const { status, record: grant, setRecord, error, retry } = useDetailData(load, { collection: "grants" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : grant ? grant.title : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this grant."} onRetry={retry} />;
  if (!grant) return <DetailNotFound noun="Grant" listLabel="Grants" listHref="/grants" />;

  const pct = Math.round((grant.allocated / grant.fundingPool) * 100);
  const remaining = grant.fundingPool - grant.allocated;

  const setAppStatus = (appId: string, next: GrantApplication["status"]) => {
    // TODO(backend): persist this change
    setRecord((prev) => {
      const applications = prev.applications.map((a) => (a.id === appId ? { ...a, status: next } : a));
      const allocated = applications.filter((a) => a.status === "approved").reduce((sum, a) => sum + a.requestedAmount, 0);
      return { ...prev, applications, allocated };
    });
  };

  const approve = (app: GrantApplication) => {
    setAppStatus(app.id, "approved");
    toast.success(`${app.applicantName}'s request for ${money(app.requestedAmount)} was approved.`);
  };

  const reject = (app: GrantApplication) =>
    confirm({
      title: "Reject this application?",
      description: (
        <>
          <strong className="text-ink">{app.applicantName}</strong>&apos;s request for {money(app.requestedAmount)} from{" "}
          <strong className="text-ink">{grant.title}</strong> will be marked Rejected.
        </>
      ),
      confirmLabel: "Reject application",
      onConfirm: () => {
        setAppStatus(app.id, "rejected");
        toast.success(`${app.applicantName}'s request was rejected.`);
      },
    });

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: HandCoins }}
            title={grant.title}
            badges={<StatusBadge status={grant.status} />}
            meta={`${grant.hirer} · ${grant.sector}`}
          />
        }
        main={
          <>
            <InfoCard title="Funding Pool">
              <div className="h-3 overflow-hidden rounded-pill bg-surface-2" role="presentation">
                <div className="h-full rounded-pill bg-purple-600 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="body-sm mt-2 text-muted">
                {money(grant.allocated)} allocated of {money(grant.fundingPool)} ({pct}%) · {money(remaining)} remaining
              </p>
            </InfoCard>

            <InfoCard title="Applications">
              {grant.applications.length === 0 ? (
                <p className="body-sm text-muted">No applications yet.</p>
              ) : (
                <ul className="space-y-3">
                  {grant.applications.map((app) => (
                    <li
                      key={app.id}
                      // Name | badge | actions. The badge is always in the same column, so it lines up on every row.
                      className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 rounded-control border border-line p-3 sm:grid-cols-[1fr_auto_auto]"
                    >
                      <div className="min-w-0">
                        <p className="body-sm break-words font-semibold text-ink">{app.applicantName}</p>
                        <p className="caption">Requested {money(app.requestedAmount)}</p>
                      </div>
                      <StatusBadge status={app.status} />

                      {/* 640px and up: compact icon buttons in a fixed-width column (empty on decided rows). */}
                      <div className="flex w-22 justify-end gap-2 max-sm:hidden">
                        {app.status === "pending" && (
                          <>
                            <IconButton
                              label={`Approve ${app.applicantName}`}
                              icon={Check}
                              tone="success"
                              disabled={app.requestedAmount > remaining}
                              onClick={() => approve(app)}
                            />
                            <IconButton label={`Reject ${app.applicantName}`} icon={X} tone="danger" onClick={() => reject(app)} />
                          </>
                        )}
                      </div>

                      {/* Phones: a second row inside the card with labelled buttons, 44px tall. */}
                      {app.status === "pending" && (
                        <div className="col-span-2 grid grid-cols-2 gap-2 sm:hidden">
                          <Button
                            variant="secondary"
                            icon={Check}
                            className="h-11"
                            aria-label={`Approve ${app.applicantName}`}
                            disabled={app.requestedAmount > remaining}
                            onClick={() => approve(app)}
                          >
                            Approve
                          </Button>
                          <Button variant="danger" icon={X} className="h-11" aria-label={`Reject ${app.applicantName}`} onClick={() => reject(app)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </InfoCard>
          </>
        }
        side={
          <>
            <InfoCard title="Details">
              <KeyValueList
                items={[
                  { label: "Hirer", value: grant.hirer },
                  { label: "Sector", value: grant.sector },
                  { label: "Funding pool", value: money(grant.fundingPool) },
                  { label: "Remaining", value: money(remaining) },
                ]}
              />
            </InfoCard>
            <InfoCard title="Activity">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-1 xl:grid-cols-2">
                <MiniStat value={grant.applications.length} label="Applications" />
                <MiniStat value={grant.applications.filter((a) => a.status === "pending").length} label="Pending" />
              </div>
            </InfoCard>
          </>
        }
      />
      {dialog}
    </>
  );
}
