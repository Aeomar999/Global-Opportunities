"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronLeft, Loader2, XCircle } from "lucide-react";
import { getEventById, updateEvent, type EventRecord } from "@/lib/api";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [capacityInput, setCapacityInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const record = await getEventById(params.id);
      setEvent(record);
      setCapacityInput(String(record.capacity));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvent();
  }, [fetchEvent]);

  const save = async (data: Parameters<typeof updateEvent>[1]) => {
    setSaving(true);
    setActionError(null);
    try {
      const record = await updateEvent(params.id, data);
      setEvent(record);
      setCapacityInput(String(record.capacity));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update event");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={24} className="animate-spin text-kb-primary" />
        <span className="ml-2 text-sm text-kb-text-muted">Loading event...</span>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div>
        <div className="flex items-center gap-2 text-sm text-kb-text-body">
          <AlertCircle size={18} className="text-kb-error" />
          <span>{error || "Event not found."}</span>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={fetchEvent} className="text-sm text-kb-primary font-semibold hover:underline">
            Retry
          </button>
          <Link href="/events" className="text-sm text-kb-primary font-semibold">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const saveCapacity = () => {
    const value = parseInt(capacityInput, 10);
    if (Number.isNaN(value) || value < event.attendeesCount) {
      setActionError(`Capacity must be a number no lower than ${event.attendeesCount}.`);
      return;
    }
    save({ capacity: value });
  };

  const pct = event.capacity > 0 ? Math.round((event.attendeesCount / event.capacity) * 100) : 0;

  return (
    <div>
      <button
        onClick={() => router.push("/events")}
        className="flex items-center gap-1.5 text-sm text-kb-text-muted hover:text-kb-text-body mb-6"
      >
        <ChevronLeft size={16} />
        Back to Events
      </button>

      <h1 className="text-xl font-bold text-kb-text-body">{event.title}</h1>
      <p className="text-sm text-kb-text-muted mt-1 mb-6">
        {event.hirer} · {event.location} · {event.dateTime}
      </p>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">
          Attendance
        </p>
        <div className="h-3 rounded-full bg-kb-bg-alt overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-kb-primary transition-all"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-sm text-kb-text-muted">
          {event.attendeesCount} of {event.capacity} spots filled ({pct}%)
        </p>
      </div>

      <div className="bg-kb-bg-card border border-kb-border rounded-2xl p-5 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder mb-3">
          Adjust Capacity
        </p>
        <div className="flex items-center gap-2 max-w-xs">
          <input
            type="number"
            value={capacityInput}
            onChange={(e) => setCapacityInput(e.target.value)}
            min={event.attendeesCount}
            className="flex-1 h-10 rounded-lg border border-kb-border-input px-3 text-sm text-kb-text-body outline-none focus:border-kb-primary"
          />
          <button
            onClick={saveCapacity}
            disabled={saving}
            className="h-10 px-4 rounded-lg bg-kb-primary text-white text-sm font-semibold disabled:opacity-60"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-kb-text-placeholder mt-2">
          Cannot be set below current attendee count ({event.attendeesCount}).
        </p>
      </div>

      {actionError && <p className="text-sm text-kb-error mb-3">{actionError}</p>}

      {event.status !== "cancelled" && (
        <button
          onClick={() => save({ status: "cancelled" })}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 hover:bg-red-100 text-sm font-semibold text-red-600 transition-colors disabled:opacity-60"
        >
          <XCircle size={16} strokeWidth={2.5} />
          Cancel event
        </button>
      )}
    </div>
  );
}
