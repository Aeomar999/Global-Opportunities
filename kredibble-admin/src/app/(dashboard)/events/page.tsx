"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, ChevronRight, Loader2 } from "lucide-react";
import { getEvents, type EventRecord } from "@/lib/api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  upcoming: { bg: "#F0FDF4", text: "#16A34A", label: "Upcoming" },
  past: { bg: "#F3F4F6", text: "#6B7280", label: "Past" },
  cancelled: { bg: "#FEF2F2", text: "#ED4C5C", label: "Cancelled" },
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents((await getEvents({ limit: 100 })).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEvents();
  }, [fetchEvents]);

  return (
    <div>
      <h1 className="text-xl font-bold text-kb-text-body mb-1">Events</h1>
      <p className="text-sm text-kb-text-muted mb-6">
        Capacity and attendance across all hirer-posted events.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={24} className="animate-spin text-kb-primary" />
          <span className="ml-2 text-sm text-kb-text-muted">Loading events...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-10 text-center">
          <AlertCircle size={24} className="text-kb-error mr-2" />
          <div className="text-sm text-kb-text-body">
            <p className="font-medium">Failed to load events</p>
            <p className="text-xs text-kb-text-muted mt-1">{error}</p>
            <button onClick={fetchEvents} className="mt-3 text-sm text-kb-primary hover:underline">
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-kb-bg-card border border-kb-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1.2fr_1fr_1.2fr_1fr_20px] gap-4 px-5 py-3 border-b border-kb-border text-xs font-semibold uppercase tracking-wide text-kb-text-placeholder">
            <span>Event</span>
            <span>Hirer</span>
            <span>Date</span>
            <span>Attendance</span>
            <span>Status</span>
            <span />
          </div>

          {events.map((event) => {
            const style = STATUS_STYLES[event.status] || STATUS_STYLES.upcoming;
            const pct = event.capacity > 0 ? Math.round((event.attendeesCount / event.capacity) * 100) : 0;
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="grid grid-cols-[2fr_1.2fr_1fr_1.2fr_1fr_20px] gap-4 px-5 py-4 items-center border-b border-kb-border last:border-b-0 hover:bg-kb-bg-alt transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-kb-bg-alt flex items-center justify-center shrink-0">
                    <CalendarDays size={16} className="text-kb-text-muted" />
                  </div>
                  <span className="text-sm font-semibold text-kb-text-body truncate" title={event.title}>
                    {event.title}
                  </span>
                </div>
                <span className="text-sm text-kb-text-muted truncate">{event.hirer}</span>
                <span className="text-sm text-kb-text-muted truncate">{event.dateTime.split(",")[0]}</span>
                <span className="text-sm text-kb-text-muted truncate">
                  {event.attendeesCount}/{event.capacity} ({pct}%)
                </span>
                <span
                  className="inline-flex w-fit text-xs font-semibold rounded-full px-2.5 py-1"
                  style={{ backgroundColor: style.bg, color: style.text }}
                >
                  {style.label}
                </span>
                <ChevronRight size={18} className="text-kb-text-placeholder justify-self-end" />
              </Link>
            );
          })}

          {events.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-kb-text-muted">No events yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
