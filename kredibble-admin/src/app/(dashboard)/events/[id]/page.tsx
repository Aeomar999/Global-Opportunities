"use client";

/**
 * Event detail: one event's attendance and capacity.
 * Built on the shared detail template.
 *
 * Fields: title, hirer, location, date & time, status, attendance (count, capacity, percent), capacity input.
 * Actions: Save capacity (cannot go below the current attendee count) and Cancel event (danger zone,
 * confirm dialog; hidden once cancelled).
 * Data: mock events (src/lib/mock-events.ts), changed in LOCAL state only.
 */
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, XCircle } from "lucide-react";
import { useBreadcrumbLabel } from "@/lib/breadcrumb-label";
import { eventRecords } from "@/lib/mock-events";
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

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const load = useCallback(() => Promise.resolve(eventRecords.find((e) => e.id === id)), [id]);
  const { status, record: event, setRecord, error, retry } = useDetailData(load, { collection: "events" });
  const toast = useToast();
  const { confirm, dialog } = useConfirmDialog();
  // null = untouched: the input then shows the saved capacity.
  const [capacityDraft, setCapacityDraft] = useState<string | null>(null);

  useBreadcrumbLabel(status === "loading" ? undefined : event ? event.title : "Not found");

  if (status === "loading") return <DetailSkeleton />;
  if (status === "error") return <DetailError message={error ?? "Could not load this event."} onRetry={retry} />;
  if (!event) return <DetailNotFound noun="Event" listLabel="Events" listHref="/events" />;

  const capacityInput = capacityDraft ?? String(event.capacity);
  const parsed = parseInt(capacityInput, 10);
  const capacityInvalid = Number.isNaN(parsed) || parsed < event.attendeesCount;
  const pct = Math.round((event.attendeesCount / event.capacity) * 100);

  const saveCapacity = () => {
    if (capacityInvalid) return;
    // TODO(backend): persist this change
    setRecord((prev) => ({ ...prev, capacity: parsed }));
    setCapacityDraft(null);
    toast.success(`Capacity for ${event.title} was set to ${parsed}.`);
  };

  const cancelEvent = () =>
    confirm({
      title: "Cancel this event?",
      description: (
        <>
          <strong className="text-ink">{event.title}</strong> by {event.hirer} ({event.dateTime}) will be marked Cancelled. Its{" "}
          {event.attendeesCount} registered attendees are affected.
        </>
      ),
      confirmLabel: "Cancel event",
      onConfirm: () => {
        // TODO(backend): persist this change
        setRecord((prev) => ({ ...prev, status: "cancelled" }));
        toast.success(`${event.title} was cancelled.`);
      },
    });

  return (
    <>
      <DetailPage
        header={
          <DetailHeader
            leading={{ icon: CalendarDays }}
            title={event.title}
            badges={<StatusBadge status={event.status} />}
            meta={`${event.hirer} · ${event.location} · ${event.dateTime}`}
          />
        }
        main={
          <>
            <InfoCard title="Attendance">
              <div className="h-3 overflow-hidden rounded-pill bg-surface-2" role="presentation">
                <div className="h-full rounded-pill bg-purple-600 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="body-sm mt-2 text-muted">
                {event.attendeesCount} of {event.capacity} spots filled ({pct}%)
              </p>
            </InfoCard>

            <InfoCard title="Adjust Capacity">
              <div className="flex max-w-xs items-center gap-2">
                <input
                  type="number"
                  aria-label="Capacity"
                  value={capacityInput}
                  onChange={(e) => setCapacityDraft(e.target.value)}
                  min={event.attendeesCount}
                  className="input-text h-10 flex-1 rounded-control border border-input bg-surface px-3 text-ink"
                />
                <Button onClick={saveCapacity} disabled={capacityInvalid}>
                  Save
                </Button>
              </div>
              <p className={`caption mt-2 ${capacityInvalid ? "text-danger" : ""}`}>
                Cannot be set below current attendee count ({event.attendeesCount}).
              </p>
            </InfoCard>
          </>
        }
        side={
          <>
            <InfoCard title="Details">
              <KeyValueList
                items={[
                  { label: "Hirer", value: event.hirer },
                  { label: "Location", value: event.location },
                  { label: "Date & Time", value: event.dateTime },
                  { label: "Capacity", value: String(event.capacity) },
                ]}
              />
            </InfoCard>
            <InfoCard title="Activity">
              <MiniStat value={event.attendeesCount} label="Attendees" />
            </InfoCard>
          </>
        }
        danger={
          event.status !== "cancelled" && (
            <DangerZone explanation="Marks this event as Cancelled. Registered attendees are affected.">
              <Button variant="danger" icon={XCircle} onClick={cancelEvent}>
                Cancel event
              </Button>
            </DangerZone>
          )
        }
      />
      {dialog}
    </>
  );
}
