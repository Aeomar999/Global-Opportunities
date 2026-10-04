"use client";

/**
 * Staff detail: one admin team member.
 * Built on the shared detail template.
 *
 * Fields: name, email, joined date, role, status.
 * Actions: change Role (Super Admin / Moderator / Support), Suspend access (danger zone, confirm
 * dialog) and Reinstate access (header, when suspended).
 * Data: the in-memory staff store (src/lib/mock-staff.ts), shared with the Staff list, so changes
 * show there too. The store IS the local state; each handler carries a TODO(backend).
 */
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { staffStore, type StaffRole } from "@/lib/mock-staff";
import { useDetailData } from "@/lib/use-detail-data";
import { DangerZone } from "@/components/detail/DangerZone";
import { DetailHeader } from "@/components/detail/DetailHeader";
import { DetailPage } from "@/components/detail/DetailPage";
import { DetailError, DetailNotFound, DetailSkeleton } from "@/components/detail/DetailStates";
import { InfoCard } from "@/components/detail/InfoCard";
import { Button } from "@/components/ui/Button";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";

const ROLES: StaffRole[] = ["Super Admin", "Moderator", "Support"];

// Module-level so the reference is stable (the store method needs its `this`).
const subscribeToStaff = (notify: () => void) => staffStore.subscribe(notify);

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => Promise.resolve(staffStore.members.find((s) => s.id === id)), [id]);
  const { status, record: staff, error, retry } = useDetailData(load, { subscribe: subscribeToStaff });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();

  useBreadcrumbLabel(status === "loading" ? undefined : staff ? staff.name : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this staff member."} onRetry={retry} />;
  if (!staff) return <DetailNotFound noun="Staff member" listLabel="Team" listHref="/team" />;

  const isActive = staff.status === "active";

  const changeRole = (role: StaffRole) => {
    if (role === staff.role) return;
    // TODO(backend): persist this change
    staffStore.updateRole(staff.id, role);
    toast.success(`${staff.name} was made ${role}.`);
  };

  const suspend = () =>
    confirm({
      title: "Suspend access?",
      description: (
        <>
          <strong className="text-ink">{staff.name}</strong> ({staff.email}, {staff.role}) will lose access to the admin until you
          reinstate it.
        </>
      ),
      confirmLabel: "Suspend access",
      onConfirm: () => {
        // TODO(backend): persist this change
        staffStore.toggleStatus(staff.id);
        toast.success(`${staff.name} was suspended.`);
      },
    });

  const reinstate = () => {
    // TODO(backend): persist this change
    staffStore.toggleStatus(staff.id);
    toast.success(`${staff.name} was reinstated.`);
  };

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ name: staff.name }}
            title={staff.name}
            badges={<StatusBadge status={staff.status} />}
            meta={`${staff.email} · Joined ${formatDate(staff.joinedDate)}`}
            actions={
              !isActive && (
                <Button variant="secondary" icon={RotateCcw} onClick={reinstate}>
                  Reinstate access
                </Button>
              )
            }
          />
        }
        main={
          <InfoCard title="Role">
            <div role="group" aria-label="Role" className="flex flex-wrap gap-2">
              {ROLES.map((role) => (
                <Button
                  key={role}
                  variant={staff.role === role ? "primary" : "secondary"}
                  aria-pressed={staff.role === role}
                  onClick={() => changeRole(role)}
                >
                  {role}
                </Button>
              ))}
            </div>
          </InfoCard>
        }
        side={
          <InfoCard title="Details">
            <KeyValueList
              items={[
                { label: "Email", value: staff.email },
                { label: "Role", value: staff.role },
                { label: "Joined", value: formatDate(staff.joinedDate) },
              ]}
            />
          </InfoCard>
        }
        danger={
          isActive && (
            <DangerZone explanation="Removes this person's access to the admin. You can reinstate it at any time.">
              <Button variant="danger" icon={Ban} onClick={suspend}>
                Suspend access
              </Button>
            </DangerZone>
          )
        }
      />
      {dialog}
    </>
  );
}
