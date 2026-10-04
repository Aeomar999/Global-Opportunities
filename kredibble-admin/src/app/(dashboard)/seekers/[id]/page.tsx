"use client";

/**
 * Seeker detail: one seeker account.
 * Built on the shared detail template (DetailPage + DetailHeader + InfoCard + KeyValueList + MiniStat).
 *
 * Fields: Email, University, Country, Joined, Applications submitted, Saved opportunities, status.
 * Actions: Suspend account (danger zone, with a confirm dialog) and Reinstate account (header).
 * Data: services/directory.ts: mock accounts in mock mode (changes go to the shared mock store), the admin API
 * (read only) otherwise. Actions stay local until the backend persists them.
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { RotateCcw, Ban } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { loadSeeker } from "@/lib/services/directory";
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
import { useToast } from "@/components/ui/Toast";

export default function SeekerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => loadSeeker(id), [id]);
  const { status, record: seeker, setRecord, error, retry } = useDetailData(load, { collection: "seekers" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  // undefined = loading (skeleton segment), otherwise the entity name shown in the breadcrumb.
  useBreadcrumbLabel(status === "loading" ? undefined : seeker ? seeker.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this seeker."} onRetry={retry} />;
  if (!seeker) return <DetailNotFound noun="Seeker" listLabel="Seekers Directory" listHref="/seekers" />;

  const isActive = seeker.status === "active";

  const suspend = () =>
    confirm({
      title: "Suspend this account?",
      description: (
        <>
          <strong className="text-ink">{seeker.name}</strong> ({seeker.email}) will be marked as Suspended. You can reinstate the
          account later.
        </>
      ),
      confirmLabel: "Suspend account",
      onConfirm: () => {
        // TODO(backend): persist this change
        setRecord((prev) => ({ ...prev, status: "suspended" }));
        toast.success(`${seeker.name} was suspended.`);
      },
    });

  const reinstate = () => {
    // TODO(backend): persist this change
    setRecord((prev) => ({ ...prev, status: "active" }));
    toast.success(`${seeker.name} was reinstated.`);
  };

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ name: seeker.name }}
            title={seeker.name}
            badges={<StatusBadge status={seeker.status} />}
            meta={seeker.profession}
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
          <InfoCard title="Activity">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MiniStat value={seeker.applicationsCount} label="Applications submitted" />
              <MiniStat value={seeker.savedCount} label="Saved opportunities" />
            </div>
          </InfoCard>
        }
        side={
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Email", value: seeker.email },
                { label: "University", value: seeker.university },
                { label: "Country", value: seeker.country },
                { label: "Joined", value: formatDate(seeker.joinedDate) },
              ]}
            />
          </InfoCard>
        }
        danger={
          isActive && (
            <DangerZone explanation="Marks this seeker's account as Suspended. You can reinstate it at any time.">
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
